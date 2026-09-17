-- Document Jobvetta as the active job provider (no schema change required).

comment on column public.jobs.source is 'Job provider: jobvetta';
