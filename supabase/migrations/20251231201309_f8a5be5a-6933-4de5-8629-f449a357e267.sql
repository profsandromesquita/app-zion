-- Add new columns for chat session management
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS color_tag TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS favorited_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add policy for users to delete their own sessions
CREATE POLICY "Users can delete their own sessions"
ON chat_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Add cascade delete for chat_messages when session is deleted
ALTER TABLE chat_messages
DROP CONSTRAINT IF EXISTS chat_messages_session_id_fkey;

ALTER TABLE chat_messages
ADD CONSTRAINT chat_messages_session_id_fkey
FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
ON DELETE CASCADE;