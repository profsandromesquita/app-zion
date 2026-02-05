-- Add DELETE policy for users to delete their own testimonies
-- ONLY when the related application status is 'testimony_required' (resubmission scenario)
CREATE POLICY "Users can delete own testimony for resubmission"
ON public.testimonies
FOR DELETE
USING (
  auth.uid() = user_id
  AND application_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.soldado_applications sa
    WHERE sa.id = testimonies.application_id
      AND sa.user_id = auth.uid()
      AND sa.status = 'testimony_required'::soldado_application_status
  )
);