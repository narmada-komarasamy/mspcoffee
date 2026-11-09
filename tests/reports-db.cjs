/* eslint-disable @typescript-eslint/no-require-imports */
const {PGlite}=require(process.env.REPORTS_PGLITE||'/tmp/msp-phone-import/node_modules/@electric-sql/pglite');
const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
 await db.exec(fs.readFileSync('supabase/migrations/20261109021625_reports_archive.sql','utf8'));
 await db.exec("insert into report_snapshots(id,reference,title,report_type,period_start,period_end,financial_year,modules,snapshot,pdf_path,pdf_sha256,page_count,created_by) values('00000000-0000-4000-8000-000000000001','TEST-1','Weekly','weekly','2026-11-02','2026-11-08',2026,'[\"distance\"]','{\"km\":100}','2026/original.pdf',repeat('a',64),1,'admin');");
 await assert.rejects(db.exec("update report_snapshots set title='replaced'"),/cannot be changed/);
 await assert.rejects(db.exec('delete from report_snapshots'),/cannot be changed/);
 await db.exec('set role anon');await assert.rejects(db.exec('select * from report_snapshots'),/permission denied/);
 await db.exec('reset role;set role authenticated');await assert.rejects(db.exec('select * from report_snapshots'),/permission denied/);
 await db.exec('reset role;set role service_role');assert.equal((await db.query('select count(*)::int as n from report_snapshots')).rows[0].n,1);
 await assert.rejects(db.exec("update report_snapshots set title='replaced'"),/permission denied/);
 await assert.rejects(db.exec('delete from report_snapshots'),/permission denied/);
 await db.exec('reset role');
 assert.equal((await db.query("select public from storage.buckets where id='report-archive'")).rows[0].public,false);
 assert.equal((await db.query("select relrowsecurity from pg_class where relname='report_snapshots'")).rows[0].relrowsecurity,true);
 await db.close();console.log('PASS: report archive migration, private bucket, row security, server-only access and immutable snapshots.');
})().catch(e=>{console.error(e);process.exit(1);});
