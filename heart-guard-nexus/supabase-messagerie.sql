-- Messagerie: conversations, messages, typing_indicators + storage bucket
-- Run this in Supabase SQL Editor if the tables don't exist yet.
-- Enable Realtime: Database → Replication → add tables "messages" and "typing_indicators" to publication.

-- Conversations: one row per doctor–patient pair
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  medecin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(patient_id, medecin_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_url TEXT,
  file_name TEXT,
  file_type TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- Typing indicators (one row per user per conversation, upserted on keydown)
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- Conversations: doctor sees own, patient sees where they are the patient
DROP POLICY IF EXISTS "conversations_select_doctor" ON public.conversations;
CREATE POLICY "conversations_select_doctor" ON public.conversations
  FOR SELECT USING (medecin_id = auth.uid());

DROP POLICY IF EXISTS "conversations_select_patient" ON public.conversations;
CREATE POLICY "conversations_select_patient" ON public.conversations
  FOR SELECT USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "conversations_insert_doctor" ON public.conversations;
CREATE POLICY "conversations_insert_doctor" ON public.conversations
  FOR INSERT WITH CHECK (medecin_id = auth.uid());

DROP POLICY IF EXISTS "conversations_update_doctor" ON public.conversations;
CREATE POLICY "conversations_update_doctor" ON public.conversations
  FOR UPDATE USING (medecin_id = auth.uid());

-- Messages: participants only
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.medecin_id = auth.uid() OR c.patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.medecin_id = auth.uid() OR c.patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.medecin_id = auth.uid() OR c.patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()))
    )
  );

-- Typing indicators
DROP POLICY IF EXISTS "typing_select" ON public.typing_indicators;
CREATE POLICY "typing_select" ON public.typing_indicators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = typing_indicators.conversation_id
      AND (c.medecin_id = auth.uid() OR c.patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "typing_insert" ON public.typing_indicators;
CREATE POLICY "typing_insert" ON public.typing_indicators
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "typing_update" ON public.typing_indicators;
CREATE POLICY "typing_update" ON public.typing_indicators
  FOR UPDATE USING (user_id = auth.uid());

-- Storage bucket for chat attachments (create in Dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true);
-- Storage policy: allow authenticated users to upload/read in chat-attachments (scope by conversation if needed)
