import { MongoClient, ObjectId } from 'mongodb';

const uri = 'mongodb+srv://skinny-ke:%40Skinny254@cluster0.zjhgrvz.mongodb.net/InterviewApp?retryWrites=true&w=majority&appName=Cluster0';

const client = new MongoClient(uri);

async function debugSession() {
  try {
    await client.connect();
    const db = client.db('InterviewApp');
    const sessions = db.collection('sessions');
    const users = db.collection('users');

    // Get all active sessions
    const activeSessions = await sessions.find({ status: 'active' }).toArray();
    
    console.log('\n=== ACTIVE SESSIONS ===');
    console.log(`Total active sessions: ${activeSessions.length}`);
    
    for (const session of activeSessions) {
      console.log(`\nSession ID: ${session._id}`);
      console.log(`  Problem: ${session.problem}`);
      console.log(`  Status: ${session.status}`);
      console.log(`  Host ID: ${session.host}`);
      console.log(`  Participant ID: ${session.participant}`);
      console.log(`  Call ID: ${session.callId}`);
      console.log(`  Created: ${session.createdAt}`);
      
      if (session.host) {
        const host = await users.findOne({ _id: session.host });
        console.log(`  Host Email: ${host?.email || 'NOT FOUND'}`);
      }
      
      if (session.participant) {
        const participant = await users.findOne({ _id: session.participant });
        console.log(`  Participant Email: ${participant?.email || 'NOT FOUND'}`);
      }
    }
    
    // Check if there are sessions with stale participants
    console.log('\n=== SESSIONS WITH MISSING HOST OR PARTICIPANT USERS ===');
    for (const session of activeSessions) {
      if (session.host) {
        const hostExists = await users.findOne({ _id: session.host });
        if (!hostExists) {
          console.log(`⚠️ Session ${session._id} has missing host user!`);
        }
      }
      if (session.participant) {
        const participantExists = await users.findOne({ _id: session.participant });
        if (!participantExists) {
          console.log(`⚠️ Session ${session._id} has missing participant user!`);
          console.log(`  Consider running: db.sessions.updateOne({_id: ObjectId("${session._id}")}, {$set: {participant: null}})`);
        }
      }
    }
    
  } finally {
    await client.close();
  }
}

debugSession().catch(console.error);
