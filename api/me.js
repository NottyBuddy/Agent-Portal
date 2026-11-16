import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET','POST'];
const MANAGER_EMAILS = new Set(['mahesh.s@hrhnext.com']);
export default async function(req,res){
 const u=req.user;
 const email=String(u.email||'').trim().toLowerCase();
 const role=MANAGER_EMAILS.has(email)?'manager':'agent';
 let q=await db.query('SELECT user_id,email,display_name,role,active FROM agent_profiles WHERE user_id=$1',[u.id]);
 if(!q.rows.length){
  await db.query('INSERT INTO agent_profiles(user_id,email,display_name,role) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO NOTHING',[u.id,email,u.name||'',role]);
 } else if(q.rows[0].role!==role || q.rows[0].email!==email){
  await db.query('UPDATE agent_profiles SET email=$2,role=$3 WHERE user_id=$1',[u.id,email,role]);
 }
 q=await db.query('SELECT user_id,email,display_name,role,active FROM agent_profiles WHERE user_id=$1',[u.id]);
 if(req.method==='POST'){
  const name=String((req.body||{}).display_name||'').trim().slice(0,80);
  if(!name)return res.status(400).json({error:'Enter a display name.'});
  await db.query('UPDATE agent_profiles SET display_name=$2 WHERE user_id=$1',[u.id,name]);
  q=await db.query('SELECT user_id,email,display_name,role,active FROM agent_profiles WHERE user_id=$1',[u.id]);
 }
 res.json({profile:q.rows[0]});
}