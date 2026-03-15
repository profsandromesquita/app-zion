DELETE FROM io_daily_sessions 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'staging_buscador1@test.com')
  AND session_date = CURRENT_DATE;