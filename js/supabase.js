
import { createClient } from
  'https://esm.sh/@supabase/supabase-js@2';

// 1. 填入你的 Supabase Project URL
const SUPABASE_URL = 'https://ogvukbxgllojnfmgdsal.supabase.co';

// 2. 填入你的 Publishable Key
const SUPABASE_KEY = 'sb_publishable_wo8yAczQh72AZ1MDgdXg8w_IrbK4TfX';

// 3. 建立資料庫連線
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
