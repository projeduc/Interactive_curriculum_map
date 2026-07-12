let SEMESTERS = {};
let COURSES = {};       // courseId -> { id, title, pre, semId }
let FORWARD = {};       // courseId -> [courseIds that list it as a prerequisite]
let TRUNK_YEARS = [];
let BRANCHES = {};

async function loadData(){
  const res = await fetch('data.json');
  if(!res.ok) throw new Error('Could not load data.json (status ' + res.status + ')');
  const json = await res.json();
  SEMESTERS = json.semesters;
  TRUNK_YEARS = json.trunkYears;
  BRANCHES = json.branches;

  COURSES = {};
  FORWARD = {};
  for(const [semId, sem] of Object.entries(SEMESTERS)){
    for(const unit of sem.units){
      for(const course of unit.courses){
        COURSES[course.id] = { ...course, semId };
      }
    }
  }
  for(const course of Object.values(COURSES)){
    for(const p of course.pre){
      if(!FORWARD[p]) FORWARD[p] = [];
      FORWARD[p].push(course.id);
    }
  }
}

// all courses (transitively) required before this one
function courseAncestors(id){
  const visited = new Set();
  function walk(courseId){
    const c = COURSES[courseId];
    if(!c) return;
    for(const p of c.pre){
      if(!visited.has(p)){ visited.add(p); walk(p); }
    }
  }
  walk(id);
  return visited;
}

// all courses (transitively) that require this one
function courseDescendants(id){
  const visited = new Set();
  function walk(courseId){
    for(const next of (FORWARD[courseId] || [])){
      if(!visited.has(next)){ visited.add(next); walk(next); }
    }
  }
  walk(id);
  return visited;
}

// semester-level ancestor/descendant, used only for the speciality pills
const SEM_EDGES = {
  cp1:['cp2'], cp2:['cp3'], cp3:['cp4'], cp4:['cs1'], cs1:['cs2'],
  cs2:['sit3','sil3','sid3','sii3'],
  sit3:['sit4'], sil3:['sil4'], sid3:['sid4'], sii3:['sii4'],
  sit4:[], sil4:[], sid4:[], sii4:[],
};
function semAncestors(id){
  const visited = new Set();
  function walk(target){
    for(const [from, tos] of Object.entries(SEM_EDGES)){
      if(tos.includes(target) && !visited.has(from)){ visited.add(from); walk(from); }
    }
  }
  walk(id);
  return visited;
}

function buildBoard(){
  const board = document.getElementById('board');
  const row = document.createElement('div');
  row.className = 'track-row';

  TRUNK_YEARS.forEach(pair=>{
    const stack = document.createElement('div');
    stack.className = 'stack-col';
    const label = document.createElement('div');
    label.className = 'stack-label';
    label.textContent = SEMESTERS[pair[0]].year;
    stack.appendChild(label);
    pair.forEach(id => stack.appendChild(semCard(id)));
    row.appendChild(stack);
  });

  const connector = document.createElement('div');
  connector.className = 'connector';
  row.appendChild(connector);

  //const branchOrder = ['it', 'il', 'id', 'ic'];
  const branchOrder = [
    ['sit', 'Information Systems and Technologies'],
    ['sil', 'Software Systems Engineering'],
    ['sid', 'Intelligent Systems and Data science'],
    ['sii', 'Computer Systems and Infrastructure']

  ];

  /*branchOrder.forEach(bk=>{
    const stack = document.createElement('div');
    stack.className = 'stack-col';
    const label = document.createElement('div');
    label.className = 'stack-label';
    //label.textContent = bk.toUpperCase();
    label.textContent = bk[1].toUpperCase();
    stack.appendChild(label);
    //BRANCHES[bk].forEach(id => stack.appendChild(semCard(id)));
    BRANCHES[bk[0]].forEach(id => stack.appendChild(semCard(id)));
    row.appendChild(stack);
  });*/
  branchOrder.forEach(bk=>{
    const stack = document.createElement('div');
    stack.className = 'stack-col';

    const label = document.createElement('button');   // was a <div>, now a real button
    label.className = 'stack-label';
    label.dataset.track = bk[0];
    label.textContent = bk[1].toUpperCase();
    label.onclick = (e)=>{ e.stopPropagation(); highlightSpeciality(bk[0]); };
    stack.appendChild(label);

    BRANCHES[bk[0]].forEach(id => stack.appendChild(semCard(id)));
    row.appendChild(stack);
  });

  board.appendChild(row);
}

function semCard(semId){
  const d = SEMESTERS[semId];
  const card = document.createElement('div');
  card.className = 'sem';
  card.id = 'sem-' + semId;
  card.dataset.sem = semId;

  const head = document.createElement('div');
  head.className = 'sem-head';
  head.innerHTML = `<span class="sem-code">${d.code}</span><span class="sem-year">${d.year}</span>`;
  card.appendChild(head);

  d.units.forEach(u=>{
    const unitEl = document.createElement('div');
    unitEl.className = 'unit';
    const codeEl = document.createElement('div');
    codeEl.className = 'unit-code';
    codeEl.textContent = u.code;
    unitEl.appendChild(codeEl);
    u.courses.forEach(course=>{
      const btn = document.createElement('button');
      btn.className = 'course';
      btn.textContent = course.title;
      btn.dataset.sem = semId;
      btn.dataset.course = course.id;
      btn.onclick = (e)=>{ e.stopPropagation(); selectCourse(course.id, btn); };
      unitEl.appendChild(btn);
    });
    card.appendChild(unitEl);
  });

  card.onclick = ()=> clearAll();
  return card;
}

function clearClasses(){
  document.querySelectorAll('.sem').forEach(el=>{
    el.classList.remove('faded', 'sel-path', 'pre-path', 'post-path');
  });
  document.querySelectorAll('.course').forEach(el=>{
    el.classList.remove('faded', 'selected', 'prereq', 'postreq');
  });
  //document.querySelectorAll('.pill[data-track]').forEach(el=> el.classList.remove('active'));
  document.querySelectorAll('[data-track]').forEach(el=> el.classList.remove('active'));
}

function clearAll(){
  clearClasses();
}

function highlightSpeciality(track){
  clearClasses();
  //document.querySelector(`.pill[data-track="${track}"]`).classList.add('active');
  document.querySelectorAll(`[data-track="${track}"]`).forEach(el => el.classList.add('active'));

  const branchSems = BRANCHES[track]; // e.g. ['id3','id4']

  // every course that belongs to this speciality's own S3/S4
  const branchCourses = new Set(
    Object.values(COURSES).filter(c => branchSems.includes(c.semId)).map(c => c.id)
  );

  // the real, course-level prerequisite chain behind every one of those courses
  const ancCourses = new Set();
  branchCourses.forEach(id=>{
    courseAncestors(id).forEach(a => ancCourses.add(a));
  });

  const ancSems = new Set([...ancCourses].map(id => COURSES[id].semId));

  document.querySelectorAll('.sem').forEach(el=>{
    const id = el.dataset.sem;
    if(branchSems.includes(id)) el.classList.add('sel-path');
    else if(ancSems.has(id)) el.classList.add('pre-path');
    else el.classList.add('faded');
  });

  document.querySelectorAll('.course').forEach(el=>{
    const id = el.dataset.course;
    if(branchCourses.has(id)) el.classList.add('selected');
    else if(ancCourses.has(id)) el.classList.add('prereq');
    else el.classList.add('faded');
  });
}

function selectCourse(courseId, btnEl){
  clearClasses();

  const anc = courseAncestors(courseId);   // prerequisite courses, any semester
  const desc = courseDescendants(courseId); // courses that require this one

  // course-level highlighting
  document.querySelectorAll('.course').forEach(el=>{
    const id = el.dataset.course;
    if(id === courseId){ el.classList.add('selected'); }
    else if(anc.has(id)){ el.classList.add('prereq'); }
    else if(desc.has(id)){ el.classList.add('postreq'); }
    else { el.classList.add('faded'); }
  });

  // semester-level framing: a semester is "in path" if it contains a related course
  const semAnc = new Set([...anc].map(id => COURSES[id].semId));
  const semDesc = new Set([...desc].map(id => COURSES[id].semId));
  const selSemId = COURSES[courseId].semId;

  document.querySelectorAll('.sem').forEach(el=>{
    const id = el.dataset.sem;
    if(id === selSemId){ el.classList.add('sel-path'); }
    else if(semAnc.has(id)){ el.classList.add('pre-path'); }
    else if(semDesc.has(id)){ el.classList.add('post-path'); }
    else { el.classList.add('faded'); }
  });
}

async function init(){
  try{
    await loadData();
    buildBoard();
  } catch(err){
    document.getElementById('board').innerHTML =
      '<p style="color:#e0946b; font-family:JetBrains Mono, monospace; font-size:13px;">' +
      'Could not load data.json — ' + err.message + '.<br><br>' +
      'Browsers block fetch() on local files opened directly (file://). ' +
      'Serve this folder with a local server, e.g. run <code>python3 -m http.server</code> ' +
      'in this folder and open http://localhost:8000/index.html.' +
      '</p>';
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', init);
