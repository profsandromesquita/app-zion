-- Add sponsor_notes column to soldado_applications
ALTER TABLE public.soldado_applications 
ADD COLUMN sponsor_notes text;