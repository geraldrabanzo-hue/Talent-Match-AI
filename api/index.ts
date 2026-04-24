import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.');
}

const supabase = createClient(supabaseUrl || '', supabaseServiceRoleKey || '');

type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[]>;
  body?: any;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: any) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

const toTitleCase = (value: any) => {
  const s = String(value || '').trim();
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const normalizeString = (value: any) => String(value || '').toLowerCase().replace(/\s+/g, '').trim();

const mapDepartment = (row: any) => ({ id: row.id, name: row.name });
const mapRole = (row: any) => ({
  id: row.id,
  title: row.title,
  departmentId: row.department_id,
  description: row.description || ''
});
const mapCandidate = (row: any) => ({
  id: row.id,
  name: row.name,
  email: row.email || '',
  recentTitle: row.recent_title || '',
  field: row.field || '',
  cvText: row.cv_text || '',
  cvUrl: row.cv_url || '',
  fileType: row.file_type || 'TXT'
});

function getPath(req: VercelRequest) {
  const raw = req.query?.path;
  const parts = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return parts.join('/');
}

async function ensureSupabase(res: VercelResponse) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    res.status(500).json({ error: 'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables.' });
    return false;
  }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!(await ensureSupabase(res))) return;

  const method = req.method || 'GET';
  const path = getPath(req);
  const parts = path.split('/').filter(Boolean);

  try {
    if (path === 'health' && method === 'GET') {
      return res.status(200).json({ status: 'ok' });
    }

    if (parts[0] === 'departments') {
      if (parts.length === 1 && method === 'GET') {
        const { data, error } = await supabase.from('departments').select('*').order('name');
        if (error) throw error;
        return res.status(200).json((data || []).map(mapDepartment));
      }

      if (parts.length === 1 && method === 'POST') {
        const name = toTitleCase(req.body?.name);
        if (!name) return res.status(400).json({ error: 'Department name is required' });

        const { data: existing, error: findError } = await supabase
          .from('departments')
          .select('*')
          .ilike('name', name)
          .limit(1);
        if (findError) throw findError;
        if (existing && existing.length > 0) return res.status(400).json({ error: 'Department already exists' });

        const { data, error } = await supabase.from('departments').insert({ name }).select('*').single();
        if (error) throw error;
        return res.status(200).json(mapDepartment(data));
      }

      if (parts.length === 2 && method === 'PUT') {
        const id = parts[1];
        const name = toTitleCase(req.body?.name);
        if (!name) return res.status(400).json({ error: 'Department name is required' });

        const { data, error } = await supabase
          .from('departments')
          .update({ name })
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw error;
        return res.status(200).json(mapDepartment(data));
      }

      if (parts.length === 2 && method === 'DELETE') {
        const id = parts[1];
        await supabase.from('job_roles').delete().eq('department_id', id);
        const { error } = await supabase.from('departments').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      if (parts[1] === 'bulk' && method === 'POST') {
        if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Invalid data format. Expected an array.' });
        let added = 0;
        let skipped = 0;
        const addedRows: any[] = [];

        for (const item of req.body) {
          const name = toTitleCase(item?.name);
          if (!name) {
            skipped++;
            continue;
          }
          const { data: existing, error: findError } = await supabase.from('departments').select('id').ilike('name', name).limit(1);
          if (findError) throw findError;
          if (existing && existing.length > 0) {
            skipped++;
            continue;
          }
          const { data, error } = await supabase.from('departments').insert({ name }).select('*').single();
          if (error) throw error;
          added++;
          addedRows.push(mapDepartment(data));
        }

        return res.status(200).json({ departments: addedRows, summary: { added, skipped } });
      }
    }

    if (parts[0] === 'roles') {
      if (parts.length === 1 && method === 'GET') {
        const { data, error } = await supabase.from('job_roles').select('*').order('title');
        if (error) throw error;
        return res.status(200).json((data || []).map(mapRole));
      }

      if (parts.length === 1 && method === 'POST') {
        const title = toTitleCase(req.body?.title);
        const departmentId = req.body?.departmentId;
        const description = req.body?.description || '';
        if (!title) return res.status(400).json({ error: 'Role title is required' });
        if (!departmentId) return res.status(400).json({ error: 'Department is required' });

        const { data, error } = await supabase
          .from('job_roles')
          .insert({ title, department_id: departmentId, description })
          .select('*')
          .single();
        if (error) throw error;
        return res.status(200).json(mapRole(data));
      }

      if (parts.length === 2 && method === 'PUT') {
        const id = parts[1];
        const update: any = {};
        if (req.body?.title !== undefined) update.title = toTitleCase(req.body.title);
        if (req.body?.departmentId !== undefined) update.department_id = req.body.departmentId;
        if (req.body?.description !== undefined) update.description = req.body.description;

        const { data, error } = await supabase.from('job_roles').update(update).eq('id', id).select('*').single();
        if (error) throw error;
        return res.status(200).json(mapRole(data));
      }

      if (parts.length === 2 && method === 'DELETE') {
        const { error } = await supabase.from('job_roles').delete().eq('id', parts[1]);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      if (parts[1] === 'bulk' && method === 'POST') {
        if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Invalid data format. Expected an array.' });
        const summary = { added: 0, updated: 0, errors: 0, departmentsCreated: 0 };
        const roles: any[] = [];

        for (const item of req.body) {
          try {
            let departmentId = item.departmentId;
            const departmentName = toTitleCase(item.departmentName || '');

            if (departmentName) {
              const { data: foundDept, error: findDeptError } = await supabase.from('departments').select('*').ilike('name', departmentName).limit(1);
              if (findDeptError) throw findDeptError;
              if (foundDept && foundDept.length > 0) {
                departmentId = foundDept[0].id;
              } else {
                const { data: newDept, error: createDeptError } = await supabase.from('departments').insert({ name: departmentName }).select('*').single();
                if (createDeptError) throw createDeptError;
                departmentId = newDept.id;
                summary.departmentsCreated++;
              }
            }

            const title = toTitleCase(item.title || '');
            if (!title || !departmentId) {
              summary.errors++;
              continue;
            }

            const { data: existing, error: findRoleError } = await supabase
              .from('job_roles')
              .select('*')
              .eq('department_id', departmentId)
              .ilike('title', title)
              .limit(1);
            if (findRoleError) throw findRoleError;

            if (existing && existing.length > 0) {
              const { data, error } = await supabase
                .from('job_roles')
                .update({ title, description: item.description || existing[0].description || '' })
                .eq('id', existing[0].id)
                .select('*')
                .single();
              if (error) throw error;
              summary.updated++;
              roles.push(mapRole(data));
            } else {
              const { data, error } = await supabase
                .from('job_roles')
                .insert({ title, department_id: departmentId, description: item.description || 'No description provided.' })
                .select('*')
                .single();
              if (error) throw error;
              summary.added++;
              roles.push(mapRole(data));
            }
          } catch (error) {
            console.error(error);
            summary.errors++;
          }
        }
        return res.status(200).json({ roles, summary });
      }
    }

    if (parts[0] === 'candidates') {
      if (parts.length === 1 && method === 'GET') {
        const { data, error } = await supabase.from('candidates').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json((data || []).map(mapCandidate));
      }

      if (parts.length === 1 && method === 'POST') {
        const name = toTitleCase(req.body?.name || 'Candidate Name');
        const email = String(req.body?.email || '').toLowerCase().trim();
        const recentTitle = req.body?.recentTitle || 'Professional';
        const field = req.body?.field || 'General Industry';
        const cvText = req.body?.cvText || '';
        const cvUrl = req.body?.cvUrl || '';
        const fileType = req.body?.fileType || 'TXT';

        let existing: any[] | null = null;
        if (email) {
          const { data, error } = await supabase.from('candidates').select('*').eq('email', email).limit(1);
          if (error) throw error;
          existing = data;
        }

        if (!existing || existing.length === 0) {
          const { data, error } = await supabase.from('candidates').select('*').ilike('name', name).limit(1);
          if (error) throw error;
          existing = data;
        }

        if (existing && existing.length > 0) {
          const { data, error } = await supabase
            .from('candidates')
            .update({ name, email, recent_title: recentTitle, field, cv_text: cvText, cv_url: cvUrl, file_type: fileType })
            .eq('id', existing[0].id)
            .select('*')
            .single();
          if (error) throw error;
          return res.status(200).json({ ...mapCandidate(data), updated: true });
        }

        const { data, error } = await supabase
          .from('candidates')
          .insert({ name, email, recent_title: recentTitle, field, cv_text: cvText, cv_url: cvUrl, file_type: fileType })
          .select('*')
          .single();
        if (error) throw error;
        return res.status(200).json(mapCandidate(data));
      }

      if (parts[1] === 'cleanup' && method === 'POST') {
        const { data, error } = await supabase.from('candidates').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        const seen = new Set<string>();
        let normalized = 0;
        let removed = 0;

        for (const candidate of data || []) {
          const newName = toTitleCase(candidate.name);
          if (newName !== candidate.name) {
            normalized++;
            await supabase.from('candidates').update({ name: newName }).eq('id', candidate.id);
          }

          const nameKey = normalizeString(newName);
          const emailKey = String(candidate.email || '').toLowerCase().trim();
          const isDuplicate = seen.has(nameKey) || (emailKey && seen.has(emailKey));
          if (isDuplicate) {
            await supabase.from('candidates').delete().eq('id', candidate.id);
            removed++;
          } else {
            seen.add(nameKey);
            if (emailKey) seen.add(emailKey);
          }
        }
        return res.status(200).json({ success: true, summary: { normalized, removed, initialCount: data?.length || 0 } });
      }

      if (parts.length === 2 && method === 'DELETE') {
        const { error } = await supabase.from('candidates').delete().eq('id', parts[1]);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }
    }

    return res.status(404).json({ error: `Route not found: ${method} /api/${path}` });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
