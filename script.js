
setTimeout(()=>{
const n=document.createElement('div');
n.className='notification';
n.innerHTML='<b>📘 Character Reminder</b><br>Princess Luna has not appeared since Chapter 2.';
document.body.appendChild(n);
},1500);

document.getElementById('msg').addEventListener('keydown',e=>{
if(e.key==='Enter'){
alert('Future GPT-4o-mini request goes here.');
}
});
