import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://interviewapp:T4LxBgxvmJ5MNxED@ac-3c1pmwm.zjhgrvz.mongodb.net/?retryWrites=true&w=majority&appName=ac-3c1pmwm';

const client = new MongoClient(uri);

async function dropIndex() {
  try {
    await client.connect();
    const db = client.db('InterviewApp');
    const collection = db.collection('users');
    
    try {
      await collection.dropIndex('email_1');
      console.log('✅ Successfully dropped email_1 index');
    } catch (err) {
      if (err.message.includes('index not found')) {
        console.log('✅ Index does not exist (already dropped)');
      } else {
        throw err;
      }
    }
  } finally {
    await client.close();
  }
}

dropIndex().catch(console.error);
