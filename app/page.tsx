// 'use client';
// import { useState, KeyboardEvent, useRef, useEffect, useCallback } from 'react';
// import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm';
// import { Database, FileText, Sparkles, Server, Terminal, BrainCircuit, Activity, UploadCloud, PieChart as PieChartIcon } from 'lucide-react';
// import * as duckdb from '@duckdb/duckdb-wasm';
// import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

// // ─── Types ────────────────────────────────────────────────────────────────────

// interface Result {
//   ans: string;
//   db: any;
//   doc: string[] | null;
//   rt: string;
//   sql: string | null;
// }

// interface SessionData {
//   csvText: string | null;
//   txtText: string | null;
//   schema: string | null;
//   dbConn: any | null;
//   dbInstance: any | null;
// }

// const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

// // ─── DuckDB WASM helpers ───────────────────────────────────────────────────────

// async function initDuckDB(csvText: string): Promise<{ conn: any; instance: any; schema: string }> {
//   const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
//   const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

//   const worker_url = URL.createObjectURL(
//     new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
//   );

//   const worker = new Worker(worker_url);
//   const logger = new duckdb.ConsoleLogger();
//   const db = new duckdb.AsyncDuckDB(logger, worker);
//   await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
//   URL.revokeObjectURL(worker_url);

//   const encoder = new TextEncoder();
//   await db.registerFileBuffer('sales.csv', encoder.encode(csvText));

//   const conn = await db.connect();
//   await conn.query(`
//     CREATE TABLE sales AS
//     SELECT * FROM read_csv_auto('sales.csv', header=true)
//   `);

//   const schemaResult = await conn.query('DESCRIBE sales');
//   const rows = schemaResult.toArray().map((r: any) => r.toJSON());
//   const cols = rows.map((r: any) => `${r.column_name} (${r.column_type})`);
//   const schema = `Table: sales\nColumns: ${cols.join(', ')}`;

//   return { conn, instance: db, schema };
// }

// async function runQueryOnConn(conn: any, sql: string): Promise<any> {
//   try {
//     const result = await conn.query(sql);
//     const rows = result.toArray().map((r: any) => r.toJSON());
//     return JSON.parse(JSON.stringify(rows, (_, v) =>
//       typeof v === 'bigint' ? v.toString() : v
//     ));
//   } catch (err: any) {
//     return { error: err.message };
//   }
// }

// // ─── Component ────────────────────────────────────────────────────────────────

// export default function Home() {
//   const [q, setQ] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [result, setResult] = useState<Result | null>(null);
//   const [err, setErr] = useState<string | null>(null);
//   const [showDbg, setShowDbg] = useState(false);

//   const [uploadLoading, setUploadLoading] = useState(false);
//   const [uploadStatus, setUploadStatus] = useState<string | null>(null);
//   const csvRef = useRef<HTMLInputElement>(null);
//   const txtRef = useRef<HTMLInputElement>(null);

//   // All data lives here — never touches the server as stored files
//   const session = useRef<SessionData>({
//     csvText: null,
//     txtText: null,
//     schema: null,
//     dbConn: null,
//     dbInstance: null,
//   });

//   const [hasData, setHasData] = useState(false);

//   // Cleanup DuckDB on page unload / component unmount
//   useEffect(() => {
//     return () => {
//       session.current.dbConn?.close?.();
//       session.current.dbInstance?.terminate?.();
//     };
//   }, []);

//   // ── Upload handler ─────────────────────────────────────────────────────────
//   const handleUpload = useCallback(async () => {
//     const csvFile = csvRef.current?.files?.[0];
//     const txtFile = txtRef.current?.files?.[0];

//     if (!csvFile && !txtFile) {
//       setUploadStatus('Please select at least one file to upload.');
//       return;
//     }

//     setUploadLoading(true);
//     setUploadStatus(null);
//     setResult(null);
//     setErr(null);

//     try {
//       // Tear down any previous DuckDB instance before loading a new CSV
//       if (session.current.dbConn) {
//         await session.current.dbConn.close();
//         session.current.dbConn = null;
//       }
//       if (session.current.dbInstance) {
//         await session.current.dbInstance.terminate();
//         session.current.dbInstance = null;
//       }
//       session.current.schema = null;

//       if (csvFile) {
//         const csvText = await csvFile.text();
//         session.current.csvText = csvText;
//         setUploadStatus('⚙️ Initialising DuckDB WASM engine...');
//         const { conn, instance, schema } = await initDuckDB(csvText);
//         session.current.dbConn = conn;
//         session.current.dbInstance = instance;
//         session.current.schema = schema;
//       }

//       if (txtFile) {
//         if (txtFile.name.toLowerCase().endsWith('.pdf')) {
//           setUploadStatus('⚙️ Parsing PDF purely in-browser...');
          
//           // Inject PDF.js directly into the browser to bypass Next.js Webpack proxy errors
//           if (!(window as any).pdfjsLib) {
//             await new Promise((resolve, reject) => {
//               const script = document.createElement('script');
//               script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
//               script.onload = resolve;
//               script.onerror = reject;
//               document.head.appendChild(script);
//             });
//           }
          
//           const pdfjsLib = (window as any).pdfjsLib;
//           pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

//           const arrayBuffer = await txtFile.arrayBuffer();
//           const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
//           const pdf = await loadingTask.promise;
          
//           let text = '';
//           for (let i = 1; i <= pdf.numPages; i++) {
//             const page = await pdf.getPage(i);
//             const content = await page.getTextContent();
//             text += content.items.map((item: any) => item.str).join(' ') + '\n';
//           }
//           session.current.txtText = text;
//         } else {
//           session.current.txtText = await txtFile.text();
//         }
//       }

//       const parts = [];
//       if (csvFile) parts.push('CSV database');
//       if (txtFile) parts.push(lowerDocName.endsWith('.pdf') ? 'PDF context' : lowerDocName.endsWith('.docx') ? 'DOCX context' : 'text context');
//       setUploadStatus(`✅ ${parts.join(' & ')} loaded into browser memory. Ready to query.`);
//       setHasData(!!(session.current.csvText || session.current.txtText));

//       if (csvRef.current) csvRef.current.value = '';
//       if (txtRef.current) txtRef.current.value = '';
//     } catch (e: any) {
//       setUploadStatus('❌ Error: ' + e.message);
//     } finally {
//       setUploadLoading(false);
//     }
//   }, []);

//   // ── Ask handler ────────────────────────────────────────────────────────────
//   const ask = useCallback(async () => {
//     const query = q.trim();
//     if (!query || loading) return;

//     if (!session.current.csvText && !session.current.txtText) {
//       setErr('No dataset loaded. Please upload a CSV and/or Document file first.');
//       return;
//     }

//     setQ('');
//     setLoading(true);
//     setResult(null);
//     setErr(null);
//     setShowDbg(false);

//     try {
//       // Step 1: Server handles routing + SQL generation + RAG
//       // Schema and TXT are sent in the body — zero server-side file storage
//       const res = await fetch('/api/chat', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           q: query,
//           schema: session.current.schema ?? null,
//           txtContent: session.current.txtText ?? null,
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || 'Unknown error');

//       // Step 2: Execute generated SQL client-side in DuckDB WASM
//       let dbRows: any = null;
//       let finalSql = data.sql ?? null;

//       if (data.sql && session.current.dbConn) {
//         dbRows = await runQueryOnConn(session.current.dbConn, data.sql);

//         // Retry with a server-fixed SQL if result is empty / null / errored
//         const isSumNull = dbRows?.length === 1 && Object.values(dbRows[0])[0] === null;
//         const isEmpty = Array.isArray(dbRows) && dbRows.length === 0;

//         if (dbRows?.error || isSumNull || isEmpty) {
//           const reason = dbRows?.error || (isEmpty ? 'Empty result set' : 'NULL sum — no matches');
//           const fixRes = await fetch('/api/fix-sql', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//               q: query,
//               schema: session.current.schema,
//               badSql: data.sql,
//               errMsg: reason,
//             }),
//           });
//           const fixData = await fixRes.json();
//           if (fixData.sql) {
//             finalSql = fixData.sql;
//             dbRows = await runQueryOnConn(session.current.dbConn, fixData.sql);
//           }
//         }
//       }

//       // Step 3: Send computed rows + doc chunks to server for LLM synthesis
//       const synthRes = await fetch('/api/synthesize', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           q: query,
//           dbRows,
//           docChunks: data.doc ?? null,
// //           evidence: data.evidence ?? data.doc ?? null,
//         }),
//       });
//       const synthData = await synthRes.json();

//       setResult({
//         ans: synthData.ans,
//         db: dbRows,
//         doc: data.doc ?? null,
//         rt: data.rt,
//         sql: finalSql,
//       });
//     } catch (e: any) {
//       setErr(e.message);
//     } finally {
//       setLoading(false);
//     }
//   }, [q, loading]);

//   function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       ask();
//     }
//   }

//   // Parse Chart Logic
//   let chartConfig: any = null;
//   let cleanAns = result?.ans || '';

//   if (result?.ans) {
//     const chartMatch = result.ans.match(/```json\n([\s\S]*?)\n```/);
//     if (chartMatch) {
//       try {
//         const parsed = JSON.parse(chartMatch[1]);
//         if (parsed.chart) {
//           chartConfig = parsed.chart;
//           cleanAns = result.ans.replace(chartMatch[0], '').trim();
//         }
//       } catch (e) {
//         console.error("Failed to parse chart json:", e);
//       }
//     }
//   }

//   // ── Render ─────────────────────────────────────────────────────────────────
//   return (
//     <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center px-4 py-16 font-sans relative overflow-x-hidden">
//       {/* Background glowing effects */}
//       <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[120px] pointer-events-none" />
//       <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none" />

//       <div className="w-full max-w-4xl flex flex-col gap-10 z-10">

//         {/* Header */}
//         <div className="text-center space-y-4 pt-10">
//           <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 mb-2 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.15)]">
//             <Sparkles className="w-4 h-4 text-blue-400" />
//             <span className="text-[11px] font-bold text-slate-300 tracking-widest uppercase">Agentic Intelligence</span>
//           </div>
//           <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight flex items-center justify-center gap-4">
//             <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">DataTalk</span>
//             Agent
//           </h1>
//           <p className="text-slate-400 mt-6 text-base max-w-xl mx-auto leading-relaxed">
//             Upload private datasets below, and the AI Agent will autonomously build a SQL engine and Vector memory map for immediate analytical synthesis.
//           </p>
//           {/* Live session indicator */}
//           <div className="flex items-center justify-center gap-2 mt-2">
//             <span className={`h-2 w-2 rounded-full transition-all ${hasData ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-slate-600'}`} />
//             <span className={`text-xs font-semibold tracking-wide ${hasData ? 'text-emerald-400' : 'text-slate-500'}`}>
//               {hasData ? 'Session active — data loaded in browser memory' : 'No data loaded — upload to begin'}
//             </span>
//           </div>
//         </div>

//         {/* Data Ingestion Panel */}
//         <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2rem] border border-slate-800/80 p-8 relative overflow-hidden shadow-2xl mt-4">
//           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-80" />

//           <div className="flex items-center gap-3 mb-2">
//             <Database className="w-5 h-5 text-blue-400" />
//             <h2 className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em]">Ingest Context Layer</h2>
//           </div>
//           <p className="text-[11px] text-slate-500 mb-6 ml-8">
//             Files load directly into browser memory — nothing is stored on any server.
//           </p>

//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
//             <div className="group border-2 border-dashed border-slate-700/80 hover:border-blue-500/50 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-950/40 hover:bg-slate-900/80 transition-all cursor-pointer relative overflow-hidden h-40">
//               <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
//               <Server className="w-8 h-8 text-slate-500 group-hover:text-blue-400 transition-colors mb-3" />
//               <p className="text-sm font-semibold text-slate-300 mb-3">Database Upload (CSV)</p>
//               <input type="file" accept=".csv" ref={csvRef} className="z-10 text-xs text-slate-400 w-[200px] file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-[11px] file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 transition-all cursor-pointer" />
//             </div>

//             <div className="group border-2 border-dashed border-slate-700/80 hover:border-purple-500/50 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-950/40 hover:bg-slate-900/80 transition-all cursor-pointer relative overflow-hidden h-40">
//               <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
//               <FileText className="w-8 h-8 text-slate-500 group-hover:text-purple-400 transition-colors mb-3" />
//               <p className="text-sm font-semibold text-slate-300 mb-3">Document Upload (PDF/DOCX/TXT)</p>
//               <input type="file" accept=".pdf,.docx,.txt,.md" ref={txtRef} className="z-10 text-xs text-slate-400 w-[200px] file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-[11px] file:font-semibold file:bg-purple-500/10 file:text-purple-400 hover:file:bg-purple-500/20 transition-all cursor-pointer" />
//             </div>
//           </div>

//           <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-slate-800/80">
//             <p className={`text-sm font-medium flex items-center gap-2 ${uploadStatus?.startsWith('✅') ? 'text-emerald-400' :
//                 uploadStatus?.startsWith('❌') ? 'text-rose-400' :
//                   uploadStatus?.startsWith('⚙️') ? 'text-blue-400' :
//                     'text-slate-500'
//               }`}>
//               {uploadStatus || 'Files are processed locally — no server storage.'}
//             </p>
//             <button
//               onClick={handleUpload}
//               disabled={uploadLoading}
//               className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 border border-indigo-500 disabled:border-slate-700 text-white text-xs font-bold uppercase tracking-widest rounded-xl px-8 py-3 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 justify-center min-w-[200px]"
//             >
//               <UploadCloud className="w-4 h-4" />
//               {uploadLoading ? 'Loading into Browser...' : 'Load into Browser'}
//             </button>
//           </div>
//         </div>

//         {/* Chat Interface */}
//         <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-slate-800/80 p-8 flex flex-col gap-6 relative">
//           <div className="flex items-center gap-3 mb-2">
//             <BrainCircuit className="w-5 h-5 text-indigo-400" />
//             <h2 className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em]">Synthesis Engine</h2>
//           </div>

//           {!hasData && (
//             <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl px-5 py-3 text-xs text-amber-400 font-medium flex items-center gap-2">
//               ⚠️ No dataset loaded. Upload a CSV and/or TXT file above before asking questions.
//             </div>
//           )}

//           <div className="relative group">
//             <textarea
//               className="w-full bg-slate-950/80 border border-slate-700 rounded-2xl px-6 py-6 text-[15px] resize-none focus:outline-none focus:ring-2 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-600 disabled:opacity-50 transition-all shadow-inner leading-relaxed"
//               rows={3}
//               placeholder={hasData ? 'Interrogate your data... (e.g. Compare total global revenue to strategic risks)' : 'Upload a dataset first...'}
//               value={q}
//               onChange={(e) => setQ(e.target.value)}
//               onKeyDown={onKey}
//               disabled={loading || !hasData}
//             />
//             {loading && (
//               <div className="absolute inset-0 bg-slate-950/60 rounded-2xl backdrop-blur-sm flex items-center justify-center border border-slate-700">
//                 <div className="flex items-center gap-3 bg-slate-900 px-6 py-3 rounded-full border border-slate-700 shadow-xl">
//                   <Activity className="w-4 h-4 text-indigo-400 animate-spin" />
//                   <span className="text-indigo-300 font-bold tracking-widest uppercase text-[10px]">Processing Pipeline...</span>
//                 </div>
//               </div>
//             )}
//           </div>

//           <button
//             onClick={ask}
//             disabled={!q.trim() || loading || !hasData}
//             className="self-end bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed border border-blue-500 disabled:border-slate-700 text-white text-xs font-bold uppercase tracking-widest rounded-xl px-10 py-3.5 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-3"
//           >
//             {loading ? 'Synthesizing...' : 'Generate Insight'}
//             {!loading && <Sparkles className="w-4 h-4 opacity-70" />}
//           </button>
//         </div>

//         {/* Error */}
//         {err && (
//           <div className="bg-rose-950/30 border-l-[3px] border-rose-500 rounded-r-2xl px-6 py-5 shadow-lg flex items-start gap-4 backdrop-blur-md">
//             <div className="bg-rose-900/50 text-rose-400 p-2 rounded-lg">⚠️</div>
//             <p className="text-rose-200 text-[15px] font-medium leading-relaxed mt-0.5">{err}</p>
//           </div>
//         )}

//         {/* Results */}
//         {result && (
//           <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out pb-20">
//             <div className="bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-blue-900/10 border border-slate-700/80 rounded-[2rem] p-10 relative overflow-hidden">
//               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] pointer-events-none rounded-full" />
//               <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-5">
//                 <div className="h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_12px_rgba(96,165,250,0.8)]" />
//                 <p className="text-xs font-bold text-blue-400 uppercase tracking-[0.15em]">Executive Brief Generated</p>
//               </div>

//               {/* Dynamic Charting Engine */}
//               {chartConfig && (
//                 <div className="mb-10 p-6 bg-slate-950/50 rounded-2xl border border-slate-800 shadow-inner">
//                   <div className="flex items-center gap-2 mb-6">
//                     <PieChartIcon className="w-4 h-4 text-purple-400" />
//                     <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Data Visualization Agent</h3>
//                   </div>
//                   <div className="w-full h-[300px]">
//                     <ResponsiveContainer width="100%" height="100%">
//                       {chartConfig.type === 'bar' ? (
//                         <BarChart data={chartConfig.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
//                           <XAxis dataKey={chartConfig.xKey} stroke="#475569" fontSize={11} tickMargin={10} />
//                           <YAxis stroke="#475569" fontSize={11} tickFormatter={(val) => `${val}`} />
//                           <Tooltip
//                             cursor={{ fill: 'rgba(51, 65, 85, 0.4)' }}
//                             contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
//                             itemStyle={{ color: '#a78bfa', fontWeight: 'bold' }}
//                           />
//                           <Bar dataKey={chartConfig.yKey} fill="#8b5cf6" radius={[6, 6, 0, 0]} />
//                         </BarChart>
//                       ) : chartConfig.type === 'line' ? (
//                         <LineChart data={chartConfig.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
//                           <XAxis dataKey={chartConfig.xKey} stroke="#475569" fontSize={11} />
//                           <YAxis stroke="#475569" fontSize={11} />
//                           <Tooltip
//                             contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }}
//                           />
//                           <Line type="monotone" dataKey={chartConfig.yKey} stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6, fill: '#60a5fa' }} />
//                         </LineChart>
//                       ) : chartConfig.type === 'pie' ? (
//                         <PieChart>
//                           <Pie data={chartConfig.data} dataKey={chartConfig.yKey} nameKey={chartConfig.xKey} cx="50%" cy="50%" outerRadius={100} innerRadius={60} paddingAngle={2} label={({name, percent}) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`} >
//                             {chartConfig.data.map((entry: any, index: number) => (
//                               <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="rgba(0,0,0,0)" />
//                             ))}
//                           </Pie>
//                           <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }} />
//                         </PieChart>
//                       ) : (
//                         <div className="flex items-center justify-center h-full text-slate-500 text-sm">Unsupported chart format</div>
//                       )}
//                     </ResponsiveContainer>
//                   </div>
//                 </div>
//               )}

//               <div className="prose-dark shrink-0">
//                 <ReactMarkdown remarkPlugins={[remarkGfm]}>
//                   {cleanAns}
//                 </ReactMarkdown>
//               </div>
//             </div>

//             <button
//               onClick={() => setShowDbg(v => !v)}
//               className="text-[11px] font-bold text-slate-400 hover:text-slate-200 self-center uppercase tracking-widest mt-4 mb-2 transition-colors flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 px-6 py-3 rounded-full shadow-lg border border-slate-700/80 backdrop-blur-md"
//             >
//               <Terminal className="w-4 h-4" />
//               {showDbg ? 'Close Diagnostics' : 'Inspect Engine Pipeline'}
//             </button>

//             {showDbg && (
//               <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl p-8 flex flex-col gap-8 text-slate-300 shadow-2xl mt-2 relative overflow-hidden">
//                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 opacity-30" />

//                 <div>
//                   <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-4 flex items-center gap-3">
//                     <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> Logic Router Module
//                   </p>
//                   <p className="text-xs font-mono text-emerald-400 bg-emerald-950/40 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-900/50 shadow-inner">
//                     TARGET: <span className="text-white font-bold">{result.rt}</span> PATH
//                   </p>
//                 </div>

//                 {result.sql && (
//                   <>
//                     <div className="border-t border-slate-800/80" />
//                     <div>
//                       <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-4 flex items-center gap-3">
//                         <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span> DuckDB WASM SQL (executed in browser)
//                       </p>
//                       <pre className="text-[13px] font-mono text-blue-300 bg-blue-950/30 p-5 rounded-2xl border border-blue-900/40 whitespace-pre-wrap break-all shadow-inner leading-relaxed">
//                         {result.sql}
//                       </pre>
//                     </div>
//                   </>
//                 )}

//                 {result.db && (
//                   <>
//                     <div className="border-t border-slate-800/80" />
//                     <div>
//                       <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-4 flex items-center gap-3">
//                         <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></span> Raw DuckDB Output
//                       </p>
//                       <pre className="text-[13px] font-mono text-orange-200 bg-orange-950/30 p-5 rounded-2xl border border-orange-900/40 overflow-x-auto whitespace-pre-wrap break-all max-h-72 overflow-y-auto shadow-inner leading-relaxed">
//                         {JSON.stringify(result.db, null, 2)}
//                       </pre>
//                     </div>
//                   </>
//                 )}

//                 {result.doc && result.doc.length > 0 && (
//                   <>
//                     <div className="border-t border-slate-800/80" />
//                     <div>
//                       <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-5 flex items-center gap-3">
//                         <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></span> Vector Context Injected
//                       </p>
//                       <div className="flex flex-col gap-4">
//                         {result.doc.map((chunk, i) => (
//                           <div key={i} className="bg-purple-950/30 p-5 rounded-2xl border border-purple-900/40 shadow-inner group transition-colors hover:bg-purple-900/40">
//                             <p className="text-[13px] font-mono text-purple-200/90 whitespace-pre-wrap leading-relaxed">
//                               {chunk}
//                             </p>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   </>
//                 )}
//               </div>
//             )}
//           </div>
//         )}

//       </div>
//     </main>
//   );
// }



//// multiple csvs

// 'use client';
// import { useState, KeyboardEvent, useRef, useEffect, useCallback } from 'react';
// import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm';
// import { Database, FileText, Sparkles, Server, Terminal, BrainCircuit, Activity, UploadCloud, PieChart as PieChartIcon, X, Table2 } from 'lucide-react';
// import * as duckdb from '@duckdb/duckdb-wasm';
// import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

// // ─── Types ────────────────────────────────────────────────────────────────────

// interface Result {
//   ans: string;
//   db: any;
//   doc: string[] | null;
//   rt: string;
//   sql: string | null;
// }

// // Each loaded CSV becomes one CsvTable entry
// interface CsvTable {
//   fileName: string;   // original file name e.g. "orders_2024.csv"
//   tableName: string;  // sanitized DuckDB table name e.g. "orders_2024"
//   schema: string;     // "Table: orders_2024\nColumns: ..."
//   conn: any;          // DuckDB WASM connection (shared instance per table)
//   instance: any;      // DuckDB WASM db instance
// }

// interface SessionData {
//   tables: CsvTable[];
//   txtText: string | null;
// }

// const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// /** Convert a filename like "My Sales 2024.csv" → "my_sales_2024" (safe SQL identifier) */
// function toTableName(fileName: string): string {
//   return fileName
//     .replace(/\.csv$/i, '')
//     .replace(/[^a-zA-Z0-9]/g, '_')
//     .replace(/^_+|_+$/g, '')
//     .replace(/_+/g, '_')
//     .toLowerCase()
//     || 'table_' + Math.random().toString(36).slice(2, 7);
// }

// // ─── DuckDB WASM helpers ───────────────────────────────────────────────────────

// async function initDuckDBTable(
//   csvText: string,
//   fileName: string
// ): Promise<CsvTable> {
//   const tableName = toTableName(fileName);

//   const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
//   const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

//   const worker_url = URL.createObjectURL(
//     new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
//   );

//   const worker = new Worker(worker_url);
//   const logger = new duckdb.ConsoleLogger();
//   const db = new duckdb.AsyncDuckDB(logger, worker);
//   await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
//   URL.revokeObjectURL(worker_url);

//   const encoder = new TextEncoder();
//   const registeredFile = `${tableName}.csv`;
//   await db.registerFileBuffer(registeredFile, encoder.encode(csvText));

//   const conn = await db.connect();
//   await conn.query(`
//     CREATE TABLE "${tableName}" AS
//     SELECT * FROM read_csv_auto('${registeredFile}', header=true)
//   `);

//   const schemaResult = await conn.query(`DESCRIBE "${tableName}"`);
//   const rows = schemaResult.toArray().map((r: any) => r.toJSON());
//   const cols = rows.map((r: any) => `${r.column_name} (${r.column_type})`);
//   const schema = `Table: ${tableName}\nColumns: ${cols.join(', ')}`;

//   return { fileName, tableName, schema, conn, instance: db };
// }

// async function runQueryOnConn(conn: any, sql: string): Promise<any> {
//   try {
//     const result = await conn.query(sql);
//     const rows = result.toArray().map((r: any) => r.toJSON());
//     return JSON.parse(JSON.stringify(rows, (_, v) =>
//       typeof v === 'bigint' ? v.toString() : v
//     ));
//   } catch (err: any) {
//     return { error: err.message };
//   }
// }

// /**
//  * Run a SQL query across ALL loaded tables by trying each connection.
//  * The generated SQL references one table name — we find the right conn.
//  */
// async function runQueryAcrossTables(
//   tables: CsvTable[],
//   sql: string
// ): Promise<{ rows: any; usedTable: string | null }> {
//   if (tables.length === 0) return { rows: { error: 'No tables loaded' }, usedTable: null };

//   // Find which table the SQL references
//   const sqlUpper = sql.toUpperCase();
//   const matchedTable = tables.find(t =>
//     sqlUpper.includes(t.tableName.toUpperCase())
//   );

//   if (matchedTable) {
//     const rows = await runQueryOnConn(matchedTable.conn, sql);
//     return { rows, usedTable: matchedTable.tableName };
//   }

//   // Fallback: try each table's connection until one works
//   for (const table of tables) {
//     const rows = await runQueryOnConn(table.conn, sql);
//     if (!rows?.error) return { rows, usedTable: table.tableName };
//   }

//   return { rows: { error: 'Query did not match any loaded table' }, usedTable: null };
// }

// // ─── Component ────────────────────────────────────────────────────────────────

// export default function Home() {
//   const [q, setQ] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [result, setResult] = useState<Result | null>(null);
//   const [err, setErr] = useState<string | null>(null);
//   const [showDbg, setShowDbg] = useState(false);

//   const [uploadLoading, setUploadLoading] = useState(false);
//   const [uploadStatus, setUploadStatus] = useState<string | null>(null);
//   const csvRef = useRef<HTMLInputElement>(null);
//   const txtRef = useRef<HTMLInputElement>(null);

//   const session = useRef<SessionData>({ tables: [], txtText: null });

//   // For UI rendering — mirror of session.current.tables (names only)
//   const [loadedTables, setLoadedTables] = useState<{ fileName: string; tableName: string }[]>([]);
//   const [hasData, setHasData] = useState(false);

//   // Cleanup DuckDB on unmount
//   useEffect(() => {
//     return () => {
//       session.current.tables.forEach(async (t) => {
//         await t.conn?.close?.();
//         await t.instance?.terminate?.();
//       });
//     };
//   }, []);

//   // ── Remove a loaded table ──────────────────────────────────────────────────
//   const removeTable = useCallback(async (tableName: string) => {
//     const target = session.current.tables.find(t => t.tableName === tableName);
//     if (target) {
//       await target.conn?.close?.();
//       await target.instance?.terminate?.();
//       session.current.tables = session.current.tables.filter(t => t.tableName !== tableName);
//       const updated = session.current.tables.map(t => ({ fileName: t.fileName, tableName: t.tableName }));
//       setLoadedTables(updated);
//       setHasData(updated.length > 0 || !!session.current.txtText);
//     }
//   }, []);

//   // ── Upload handler ─────────────────────────────────────────────────────────
//   const handleUpload = useCallback(async () => {
//     const csvFiles = csvRef.current?.files ? Array.from(csvRef.current.files) : [];
//     const txtFile = txtRef.current?.files?.[0];

//     if (csvFiles.length === 0 && !txtFile) {
//       setUploadStatus('Please select at least one file to upload.');
//       return;
//     }

//     setUploadLoading(true);
//     setUploadStatus(null);
//     setResult(null);
//     setErr(null);

//     try {
//       // ── Load each CSV as its own DuckDB table ────────────────────────────
//       if (csvFiles.length > 0) {
//         for (let i = 0; i < csvFiles.length; i++) {
//           const file = csvFiles[i];
//           const tableName = toTableName(file.name);

//           console.log(`[Upload] Processing file ${i + 1}/${csvFiles.length}: "${file.name}" → table: "${tableName}"`);

//           // If a table with this name already exists, tear it down first
//           const existing = session.current.tables.find(t => t.tableName === tableName);
//           if (existing) {
//             await existing.conn?.close?.();
//             await existing.instance?.terminate?.();
//             session.current.tables = session.current.tables.filter(t => t.tableName !== tableName);
//           }

//           setUploadStatus(`⚙️ Loading ${file.name} into DuckDB (${i + 1}/${csvFiles.length})...`);
//           const csvText = await file.text();
//           const table = await initDuckDBTable(csvText, file.name);
//           session.current.tables.push(table);

//           console.log(`[Upload] ✅ Table "${tableName}" ready. Total tables: ${session.current.tables.length}`);

//           // Update chips after EACH file so the user sees progress
//           const progressSnapshot = session.current.tables.map(t => ({
//             fileName: t.fileName,
//             tableName: t.tableName,
//           }));
//           setLoadedTables([...progressSnapshot]);
//           setHasData(true);
//         }
//       }

//       // ── Load TXT / PDF ───────────────────────────────────────────────────
//       if (txtFile) {
//         if (txtFile.name.toLowerCase().endsWith('.pdf')) {
//           setUploadStatus('⚙️ Parsing PDF purely in-browser...');

//           if (!(window as any).pdfjsLib) {
//             await new Promise((resolve, reject) => {
//               const script = document.createElement('script');
//               script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
//               script.onload = resolve;
//               script.onerror = reject;
//               document.head.appendChild(script);
//             });
//           }

//           const pdfjsLib = (window as any).pdfjsLib;
//           pdfjsLib.GlobalWorkerOptions.workerSrc =
//             'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

//           const arrayBuffer = await txtFile.arrayBuffer();
//           const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

//           let text = '';
//           for (let i = 1; i <= pdf.numPages; i++) {
//             const page = await pdf.getPage(i);
//             const content = await page.getTextContent();
//             text += content.items.map((item: any) => item.str).join(' ') + '\n';
//           }
//           session.current.txtText = text;
//         } else {
//           session.current.txtText = await txtFile.text();
//         }
//       }

//       const updated = session.current.tables.map(t => ({
//         fileName: t.fileName,
//         tableName: t.tableName,
//       }));
//       setLoadedTables([...updated]);
//       setHasData(updated.length > 0 || !!session.current.txtText);

//       const parts: string[] = [];
//       if (csvFiles.length > 0)
//         parts.push(`${csvFiles.length} CSV table${csvFiles.length > 1 ? 's' : ''}`);
//       if (txtFile)
//         parts.push(txtFile.name.toLowerCase().endsWith('.pdf') ? 'PDF context' : 'TXT context');

//       setUploadStatus(`✅ ${parts.join(' & ')} loaded into browser memory. Ready to query.`);

//       if (csvRef.current) csvRef.current.value = '';
//       if (txtRef.current) txtRef.current.value = '';
//     } catch (e: any) {
//       setUploadStatus('❌ Error: ' + e.message);
//     } finally {
//       setUploadLoading(false);
//     }
//   }, []);

//   // ── Ask handler ────────────────────────────────────────────────────────────
//   const ask = useCallback(async () => {
//     const query = q.trim();
//     if (!query || loading) return;

//     if (session.current.tables.length === 0 && !session.current.txtText) {
//       setErr('No dataset loaded. Please upload a CSV and/or Document file first.');
//       return;
//     }

//     setQ('');
//     setLoading(true);
//     setResult(null);
//     setErr(null);
//     setShowDbg(false);

//     try {
//       // Build combined schema string from ALL loaded tables
//       const combinedSchema = session.current.tables.length > 0
//         ? session.current.tables.map(t => t.schema).join('\n\n')
//         : null;

//       // Step 1: Server — routing + SQL generation + RAG
//       const res = await fetch('/api/chat', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           q: query,
//           schema: combinedSchema,
//           txtContent: session.current.txtText ?? null,
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || 'Unknown error');

//       // Step 2: Execute generated SQL client-side in DuckDB WASM
//       let dbRows: any = null;
//       let finalSql = data.sql ?? null;

//       if (data.sql && session.current.tables.length > 0) {
//         const { rows, usedTable } = await runQueryAcrossTables(session.current.tables, data.sql);
//         dbRows = rows;

//         // Retry with fixed SQL if result is empty / null / errored
//         const isSumNull = dbRows?.length === 1 && Object.values(dbRows[0])[0] === null;
//         const isEmpty = Array.isArray(dbRows) && dbRows.length === 0;

//         if (dbRows?.error || isSumNull || isEmpty) {
//           const reason = dbRows?.error || (isEmpty ? 'Empty result set' : 'NULL sum — no matches');
//           const fixRes = await fetch('/api/fix-sql', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//               q: query,
//               schema: combinedSchema,
//               badSql: data.sql,
//               errMsg: reason,
//             }),
//           });
//           const fixData = await fixRes.json();
//           if (fixData.sql) {
//             finalSql = fixData.sql;
//             const { rows: retryRows } = await runQueryAcrossTables(session.current.tables, fixData.sql);
//             dbRows = retryRows;
//           }
//         }
//       }

//       // Step 3: LLM synthesis
//       const synthRes = await fetch('/api/synthesize', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           q: query,
//           dbRows,
//           docChunks: data.doc ?? null,
//           evidence: data.evidence ?? data.doc ?? null,
//         }),
//       });
//       const synthData = await synthRes.json();

//       setResult({
//         ans: synthData.ans,
//         db: dbRows,
//         doc: data.doc ?? null,
//         rt: data.rt,
//         sql: finalSql,
//       });
//     } catch (e: any) {
//       setErr(e.message);
//     } finally {
//       setLoading(false);
//     }
//   }, [q, loading]);

//   function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault();
//       ask();
//     }
//   }

//   // Parse Chart JSON from LLM response
//   let chartConfig: any = null;
//   let cleanAns = result?.ans || '';

//   if (result?.ans) {
//     const chartMatch = result.ans.match(/```json\n([\s\S]*?)\n```/);
//     if (chartMatch) {
//       try {
//         const parsed = JSON.parse(chartMatch[1]);
//         if (parsed.chart) {
//           chartConfig = parsed.chart;
//           cleanAns = result.ans.replace(chartMatch[0], '').trim();
//         }
//       } catch (e) {
//         console.error('Failed to parse chart json:', e);
//       }
//     }
//   }

//   // ── Render ─────────────────────────────────────────────────────────────────
//   return (
//     <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center px-4 py-16 font-sans relative overflow-x-hidden">
//       <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[120px] pointer-events-none" />
//       <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none" />

//       <div className="w-full max-w-4xl flex flex-col gap-10 z-10">

//         {/* Header */}
//         <div className="text-center space-y-4 pt-10">
//           <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 mb-2 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.15)]">
//             <Sparkles className="w-4 h-4 text-blue-400" />
//             <span className="text-[11px] font-bold text-slate-300 tracking-widest uppercase">Agentic Intelligence</span>
//           </div>
//           <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight flex items-center justify-center gap-4">
//             <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">DataTalk</span>
//             Agent
//           </h1>
//           <p className="text-slate-400 mt-6 text-base max-w-xl mx-auto leading-relaxed">
//             Upload multiple datasets below. The AI Agent will build a SQL engine for each table and vector memory for your documents.
//           </p>
//           <div className="flex items-center justify-center gap-2 mt-2">
//             <span className={`h-2 w-2 rounded-full transition-all ${hasData ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-slate-600'}`} />
//             <span className={`text-xs font-semibold tracking-wide ${hasData ? 'text-emerald-400' : 'text-slate-500'}`}>
//               {hasData
//                 ? `Session active — ${loadedTables.length} table${loadedTables.length !== 1 ? 's' : ''} loaded`
//                 : 'No data loaded — upload to begin'}
//             </span>
//           </div>
//         </div>

//         {/* Data Ingestion Panel */}
//         <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2rem] border border-slate-800/80 p-8 relative overflow-hidden shadow-2xl mt-4">
//           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-80" />

//           <div className="flex items-center gap-3 mb-2">
//             <Database className="w-5 h-5 text-blue-400" />
//             <h2 className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em]">Ingest Context Layer</h2>
//           </div>
//           <p className="text-[11px] text-slate-500 mb-6 ml-8">
//             Files load directly into browser memory — nothing is stored on any server. Select multiple CSVs to query across tables.
//           </p>

//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
//             {/* CSV upload — multiple */}
//             <div className="group border-2 border-dashed border-slate-700/80 hover:border-blue-500/50 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-950/40 hover:bg-slate-900/80 transition-all cursor-pointer relative overflow-hidden min-h-[160px]">
//               <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
//               <Server className="w-8 h-8 text-slate-500 group-hover:text-blue-400 transition-colors mb-3" />
//               <p className="text-sm font-semibold text-slate-300 mb-1">Database Upload (CSV)</p>
//               <p className="text-[10px] text-slate-500 mb-3">Multiple files supported</p>
//               <input
//                 type="file"
//                 accept=".csv"
//                 multiple
//                 ref={csvRef}
//                 className="z-10 text-xs text-slate-400 w-[200px] file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-[11px] file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 transition-all cursor-pointer"
//               />
//             </div>

//             {/* TXT/PDF upload */}
//             <div className="group border-2 border-dashed border-slate-700/80 hover:border-purple-500/50 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-950/40 hover:bg-slate-900/80 transition-all cursor-pointer relative overflow-hidden min-h-[160px]">
//               <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
//               <FileText className="w-8 h-8 text-slate-500 group-hover:text-purple-400 transition-colors mb-3" />
//               <p className="text-sm font-semibold text-slate-300 mb-3">Document Upload (PDF/DOCX/TXT)</p>
//               <input
//                 type="file"
//                 accept=".pdf,.txt"
//                 ref={txtRef}
//                 className="z-10 text-xs text-slate-400 w-[200px] file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-[11px] file:font-semibold file:bg-purple-500/10 file:text-purple-400 hover:file:bg-purple-500/20 transition-all cursor-pointer"
//               />
//             </div>
//           </div>

//           {/* Loaded tables chips */}
//           {loadedTables.length > 0 && (
//             <div className="mb-6 flex flex-wrap gap-2">
//               {loadedTables.map(t => (
//                 <div
//                   key={t.tableName}
//                   className="flex items-center gap-2 bg-blue-950/50 border border-blue-800/60 rounded-full px-3 py-1.5 text-[11px] font-semibold text-blue-300"
//                 >
//                   <Table2 className="w-3 h-3" />
//                   <span className="font-mono">{t.tableName}</span>
//                   <span className="text-slate-500 text-[10px]">({t.fileName})</span>
//                   <button
//                     onClick={() => removeTable(t.tableName)}
//                     className="ml-1 text-slate-500 hover:text-rose-400 transition-colors"
//                     title={`Remove ${t.tableName}`}
//                   >
//                     <X className="w-3 h-3" />
//                   </button>
//                 </div>
//               ))}
//             </div>
//           )}

//           <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-slate-800/80">
//             <p className={`text-sm font-medium flex items-center gap-2 ${
//               uploadStatus?.startsWith('✅') ? 'text-emerald-400' :
//               uploadStatus?.startsWith('❌') ? 'text-rose-400' :
//               uploadStatus?.startsWith('⚙️') ? 'text-blue-400' :
//               'text-slate-500'
//             }`}>
//               {uploadStatus || 'Files are processed locally — no server storage.'}
//             </p>
//             <button
//               onClick={handleUpload}
//               disabled={uploadLoading}
//               className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 border border-indigo-500 disabled:border-slate-700 text-white text-xs font-bold uppercase tracking-widest rounded-xl px-8 py-3 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 justify-center min-w-[200px]"
//             >
//               <UploadCloud className="w-4 h-4" />
//               {uploadLoading ? 'Loading into Browser...' : 'Load into Browser'}
//             </button>
//           </div>
//         </div>

//         {/* Chat Interface */}
//         <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-slate-800/80 p-8 flex flex-col gap-6 relative">
//           <div className="flex items-center gap-3 mb-2">
//             <BrainCircuit className="w-5 h-5 text-indigo-400" />
//             <h2 className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em]">Synthesis Engine</h2>
//           </div>

//           {!hasData && (
//             <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl px-5 py-3 text-xs text-amber-400 font-medium flex items-center gap-2">
//               ⚠️ No dataset loaded. Upload CSV files and/or a TXT/PDF document above before asking questions.
//             </div>
//           )}

//           {/* Schema hint when multiple tables loaded */}
//           {loadedTables.length > 1 && (
//             <div className="bg-blue-950/30 border border-blue-800/50 rounded-xl px-5 py-3 text-xs text-blue-300 font-medium flex items-start gap-2">
//               <Table2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
//               <span>
//                 <strong>{loadedTables.length} tables loaded.</strong> You can ask questions that reference specific tables by name (
//                 {loadedTables.map(t => <code key={t.tableName} className="mx-0.5 bg-slate-800 px-1 rounded">{t.tableName}</code>)})
//                 or ask cross-table questions and the agent will decide.
//               </span>
//             </div>
//           )}

//           <div className="relative group">
//             <textarea
//               className="w-full bg-slate-950/80 border border-slate-700 rounded-2xl px-6 py-6 text-[15px] resize-none focus:outline-none focus:ring-2 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-600 disabled:opacity-50 transition-all shadow-inner leading-relaxed"
//               rows={3}
//               placeholder={
//                 hasData
//                   ? loadedTables.length > 1
//                     ? `Ask across tables... (e.g. Show total revenue from ${loadedTables[0]?.tableName} grouped by region)`
//                     : 'Interrogate your data... (e.g. Compare total global revenue to strategic risks)'
//                   : 'Upload a dataset first...'
//               }
//               value={q}
//               onChange={(e) => setQ(e.target.value)}
//               onKeyDown={onKey}
//               disabled={loading || !hasData}
//             />
//             {loading && (
//               <div className="absolute inset-0 bg-slate-950/60 rounded-2xl backdrop-blur-sm flex items-center justify-center border border-slate-700">
//                 <div className="flex items-center gap-3 bg-slate-900 px-6 py-3 rounded-full border border-slate-700 shadow-xl">
//                   <Activity className="w-4 h-4 text-indigo-400 animate-spin" />
//                   <span className="text-indigo-300 font-bold tracking-widest uppercase text-[10px]">Processing Pipeline...</span>
//                 </div>
//               </div>
//             )}
//           </div>

//           <button
//             onClick={ask}
//             disabled={!q.trim() || loading || !hasData}
//             className="self-end bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed border border-blue-500 disabled:border-slate-700 text-white text-xs font-bold uppercase tracking-widest rounded-xl px-10 py-3.5 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-3"
//           >
//             {loading ? 'Synthesizing...' : 'Generate Insight'}
//             {!loading && <Sparkles className="w-4 h-4 opacity-70" />}
//           </button>
//         </div>

//         {/* Error */}
//         {err && (
//           <div className="bg-rose-950/30 border-l-[3px] border-rose-500 rounded-r-2xl px-6 py-5 shadow-lg flex items-start gap-4 backdrop-blur-md">
//             <div className="bg-rose-900/50 text-rose-400 p-2 rounded-lg">⚠️</div>
//             <p className="text-rose-200 text-[15px] font-medium leading-relaxed mt-0.5">{err}</p>
//           </div>
//         )}

//         {/* Results */}
//         {result && (
//           <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out pb-20">
//             <div className="bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-blue-900/10 border border-slate-700/80 rounded-[2rem] p-10 relative overflow-hidden">
//               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] pointer-events-none rounded-full" />
//               <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-5">
//                 <div className="h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_12px_rgba(96,165,250,0.8)]" />
//                 <p className="text-xs font-bold text-blue-400 uppercase tracking-[0.15em]">Executive Brief Generated</p>
//               </div>

//               {/* Chart */}
//               {chartConfig && (
//                 <div className="mb-10 p-6 bg-slate-950/50 rounded-2xl border border-slate-800 shadow-inner">
//                   <div className="flex items-center gap-2 mb-6">
//                     <PieChartIcon className="w-4 h-4 text-purple-400" />
//                     <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Data Visualization Agent</h3>
//                   </div>
//                   <div className="w-full h-[300px]">
//                     <ResponsiveContainer width="100%" height="100%">
//                       {chartConfig.type === 'bar' ? (
//                         <BarChart data={chartConfig.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
//                           <XAxis dataKey={chartConfig.xKey} stroke="#475569" fontSize={11} tickMargin={10} />
//                           <YAxis stroke="#475569" fontSize={11} />
//                           <Tooltip
//                             cursor={{ fill: 'rgba(51,65,85,0.4)' }}
//                             contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }}
//                             itemStyle={{ color: '#a78bfa', fontWeight: 'bold' }}
//                           />
//                           <Bar dataKey={chartConfig.yKey} fill="#8b5cf6" radius={[6, 6, 0, 0]} />
//                         </BarChart>
//                       ) : chartConfig.type === 'line' ? (
//                         <LineChart data={chartConfig.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
//                           <XAxis dataKey={chartConfig.xKey} stroke="#475569" fontSize={11} />
//                           <YAxis stroke="#475569" fontSize={11} />
//                           <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }} />
//                           <Line type="monotone" dataKey={chartConfig.yKey} stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6, fill: '#60a5fa' }} />
//                         </LineChart>
//                       ) : chartConfig.type === 'pie' ? (
//                         <PieChart>
//                           <Pie data={chartConfig.data} dataKey={chartConfig.yKey} nameKey={chartConfig.xKey} cx="50%" cy="50%" outerRadius={100} innerRadius={60} paddingAngle={2} label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}>
//                             {chartConfig.data.map((_: any, index: number) => (
//                               <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="rgba(0,0,0,0)" />
//                             ))}
//                           </Pie>
//                           <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }} />
//                         </PieChart>
//                       ) : (
//                         <BarChart data={[]}><XAxis /><YAxis /></BarChart>
//                       )}
//                     </ResponsiveContainer>
//                   </div>
//                 </div>
//               )}

//               <div className="prose-dark shrink-0">
//                 <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanAns}</ReactMarkdown>
//               </div>
//             </div>

//             <button
//               onClick={() => setShowDbg(v => !v)}
//               className="text-[11px] font-bold text-slate-400 hover:text-slate-200 self-center uppercase tracking-widest mt-4 mb-2 transition-colors flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 px-6 py-3 rounded-full shadow-lg border border-slate-700/80 backdrop-blur-md"
//             >
//               <Terminal className="w-4 h-4" />
//               {showDbg ? 'Close Diagnostics' : 'Inspect Engine Pipeline'}
//             </button>

//             {showDbg && (
//               <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl p-8 flex flex-col gap-8 text-slate-300 shadow-2xl mt-2 relative overflow-hidden">
//                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 opacity-30" />

//                 <div>
//                   <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-4 flex items-center gap-3">
//                     <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> Logic Router Module
//                   </p>
//                   <p className="text-xs font-mono text-emerald-400 bg-emerald-950/40 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-900/50">
//                     TARGET: <span className="text-white font-bold ml-1">{result.rt}</span> PATH
//                   </p>
//                 </div>

//                 {/* Loaded tables summary */}
//                 {loadedTables.length > 0 && (
//                   <>
//                     <div className="border-t border-slate-800/80" />
//                     <div>
//                       <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-4 flex items-center gap-3">
//                         <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" /> Loaded Tables
//                       </p>
//                       <div className="flex flex-wrap gap-2">
//                         {loadedTables.map(t => (
//                           <span key={t.tableName} className="font-mono text-[11px] bg-cyan-950/40 text-cyan-300 border border-cyan-900/40 px-3 py-1 rounded-lg">
//                             {t.tableName}
//                           </span>
//                         ))}
//                       </div>
//                     </div>
//                   </>
//                 )}

//                 {result.sql && (
//                   <>
//                     <div className="border-t border-slate-800/80" />
//                     <div>
//                       <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-4 flex items-center gap-3">
//                         <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" /> DuckDB WASM SQL (executed in browser)
//                       </p>
//                       <pre className="text-[13px] font-mono text-blue-300 bg-blue-950/30 p-5 rounded-2xl border border-blue-900/40 whitespace-pre-wrap break-all shadow-inner leading-relaxed">
//                         {result.sql}
//                       </pre>
//                     </div>
//                   </>
//                 )}

//                 {result.db && (
//                   <>
//                     <div className="border-t border-slate-800/80" />
//                     <div>
//                       <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-4 flex items-center gap-3">
//                         <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" /> Raw DuckDB Output
//                       </p>
//                       <pre className="text-[13px] font-mono text-orange-200 bg-orange-950/30 p-5 rounded-2xl border border-orange-900/40 overflow-x-auto whitespace-pre-wrap break-all max-h-72 overflow-y-auto shadow-inner leading-relaxed">
//                         {JSON.stringify(result.db, null, 2)}
//                       </pre>
//                     </div>
//                   </>
//                 )}

//                 {result.doc && result.doc.length > 0 && (
//                   <>
//                     <div className="border-t border-slate-800/80" />
//                     <div>
//                       <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-5 flex items-center gap-3">
//                         <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" /> Vector Context Injected
//                       </p>
//                       <div className="flex flex-col gap-4">
//                         {result.doc.map((chunk, i) => (
//                           <div key={i} className="bg-purple-950/30 p-5 rounded-2xl border border-purple-900/40 shadow-inner hover:bg-purple-900/40 transition-colors">
//                             <p className="text-[13px] font-mono text-purple-200/90 whitespace-pre-wrap leading-relaxed">{chunk}</p>
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   </>
//                 )}
//               </div>
//             )}
//           </div>
//         )}

//       </div>
//     </main>
//   );
// }



//////context window 

'use client';
import { useState, KeyboardEvent, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as mammoth from 'mammoth/mammoth.browser';
import { Database, FileText, Sparkles, Server, Terminal, BrainCircuit, Activity, UploadCloud, PieChart as PieChartIcon, X, Table2, Trash2, User } from 'lucide-react';
import * as duckdb from '@duckdb/duckdb-wasm';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

// Mirrors lib/insight.ts Message — sent to /api/synthesize as history
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Result {
  ans: string;
  db: any;
  doc: string[] | null;
  rt: string;
  sql: string | null;
  verification?: { status: 'PASS' | 'FAIL' | 'UNCERTAIN'; issues: string[]; attempts: number };
}

// One visible turn in the chat thread
interface ChatEntry {
  question: string;
  result: Result;
}

interface CsvTable {
  fileName: string;
  tableName: string;
  schema: string;
  conn: any;
  instance: any;
}

interface SessionData {
  tables: CsvTable[];
  txtText: string | null;
}

const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const MAX_HISTORY_TURNS = 6; // keep last 6 user+assistant pairs = 12 messages

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toTableName(fileName: string): string {
  return (
    fileName
      .replace(/\.csv$/i, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')
      .toLowerCase() || 'table_' + Math.random().toString(36).slice(2, 7)
  );
}

function parseChart(ans: string): { chartConfig: any; cleanAns: string } {
  const m = ans.match(/```json\n([\s\S]*?)\n```/);
  if (m) {
    try {
      const parsed = JSON.parse(m[1]);
      if (parsed.chart) return { chartConfig: parsed.chart, cleanAns: ans.replace(m[0], '').trim() };
    } catch {}
  }
  return { chartConfig: null, cleanAns: ans };
}

// ─── DuckDB WASM ──────────────────────────────────────────────────────────────

async function initDuckDBTable(csvText: string, fileName: string): Promise<CsvTable> {
  const tableName = toTableName(fileName);
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
  );
  const worker = new Worker(worker_url);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(worker_url);

  const encoder = new TextEncoder();
  const registeredFile = `${tableName}.csv`;
  await db.registerFileBuffer(registeredFile, encoder.encode(csvText));

  const conn = await db.connect();
  await conn.query(`CREATE TABLE "${tableName}" AS SELECT * FROM read_csv_auto('${registeredFile}', header=true)`);

  const schemaResult = await conn.query(`DESCRIBE "${tableName}"`);
  const rows = schemaResult.toArray().map((r: any) => r.toJSON());
  const cols = rows.map((r: any) => `${r.column_name} (${r.column_type})`);
  const schema = `Table: ${tableName}\nColumns: ${cols.join(', ')}`;

  return { fileName, tableName, schema, conn, instance: db };
}

async function runQueryOnConn(conn: any, sql: string): Promise<any> {
  try {
    const result = await conn.query(sql);
    const rows = result.toArray().map((r: any) => r.toJSON());
    return JSON.parse(JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
  } catch (err: any) {
    return { error: err.message };
  }
}

async function runQueryAcrossTables(
  tables: CsvTable[],
  sql: string
): Promise<{ rows: any; usedTable: string | null }> {
  if (tables.length === 0) return { rows: { error: 'No tables loaded' }, usedTable: null };
  const sqlUpper = sql.toUpperCase();
  const matched = tables.find(t => sqlUpper.includes(t.tableName.toUpperCase()));
  if (matched) {
    return { rows: await runQueryOnConn(matched.conn, sql), usedTable: matched.tableName };
  }
  for (const t of tables) {
    const rows = await runQueryOnConn(t.conn, sql);
    if (!rows?.error) return { rows, usedTable: t.tableName };
  }
  return { rows: { error: 'Query did not match any loaded table' }, usedTable: null };
}

// ─── Chart component ──────────────────────────────────────────────────────────

function ChartBlock({ config }: { config: any }) {
  return (
    <div className="mb-8 p-5 bg-slate-950/50 rounded-2xl border border-slate-800 shadow-inner">
      <div className="flex items-center gap-2 mb-4">
        <PieChartIcon className="w-4 h-4 text-purple-400" />
        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Data Visualization</span>
      </div>
      <div className="w-full h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          {config.type === 'bar' ? (
            <BarChart data={config.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey={config.xKey} stroke="#475569" fontSize={11} tickMargin={10} />
              <YAxis stroke="#475569" fontSize={11} />
              <Tooltip cursor={{ fill: 'rgba(51,65,85,0.4)' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }} itemStyle={{ color: '#a78bfa', fontWeight: 'bold' }} />
              <Bar dataKey={config.yKey} fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          ) : config.type === 'line' ? (
            <LineChart data={config.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey={config.xKey} stroke="#475569" fontSize={11} />
              <YAxis stroke="#475569" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }} />
              <Line type="monotone" dataKey={config.yKey} stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6, fill: '#60a5fa' }} />
            </LineChart>
          ) : config.type === 'pie' ? (
            <PieChart>
              <Pie data={config.data} dataKey={config.yKey} nameKey={config.xKey} cx="50%" cy="50%" outerRadius={100} innerRadius={60} paddingAngle={2} label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}>
                {config.data.map((_: any, i: number) => (
                  <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="rgba(0,0,0,0)" />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }} />
            </PieChart>
          ) : (
            <BarChart data={[]}><XAxis /><YAxis /></BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Single chat turn ─────────────────────────────────────────────────────────

function ChatTurn({ entry }: { entry: ChatEntry }) {
  const [showDbg, setShowDbg] = useState(false);
  const { chartConfig, cleanAns } = parseChart(entry.result.ans);

  return (
    <div className="flex flex-col gap-3">
      {/* User bubble */}
      <div className="flex items-start gap-3 justify-end">
        <div className="max-w-[80%] bg-indigo-600/20 border border-indigo-500/30 rounded-2xl rounded-tr-sm px-5 py-3.5">
          <p className="text-sm text-slate-200 leading-relaxed">{entry.question}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-indigo-300" />
        </div>
      </div>

      {/* Assistant bubble */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <BrainCircuit className="w-4 h-4 text-blue-300" />
        </div>
        <div className="flex-1 bg-slate-900/80 border border-slate-700/80 rounded-2xl rounded-tl-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500/50 via-indigo-500/30 to-transparent" />

          {chartConfig && <ChartBlock config={chartConfig} />}

          <div className="prose-dark text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanAns}</ReactMarkdown>
          </div>

          {entry.result.verification && (
            <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${
              entry.result.verification.status === 'PASS' ? 'text-emerald-300 border-emerald-800 bg-emerald-950/30' :
              entry.result.verification.status === 'FAIL' ? 'text-rose-300 border-rose-800 bg-rose-950/30' :
              'text-amber-300 border-amber-800 bg-amber-950/30'
            }`}>
              {entry.result.verification.status === 'PASS' ? '✓ Evidence verified' : entry.result.verification.status === 'FAIL' ? '⚠ Needs review' : '? Verification uncertain'}
              <span className="opacity-60">{entry.result.verification.attempts} pass{entry.result.verification.attempts !== 1 ? 'es' : ''}</span>
            </div>
          )}

          {/* Per-turn pipeline inspector */}
          <button
            onClick={() => setShowDbg(v => !v)}
            className="mt-5 text-[10px] font-bold text-slate-600 hover:text-slate-400 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
          >
            <Terminal className="w-3 h-3" />
            {showDbg ? 'Hide pipeline' : 'Inspect pipeline'}
          </button>

          {showDbg && (
            <div className="mt-4 bg-[#0B0F19] border border-slate-800 rounded-2xl p-5 flex flex-col gap-5">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Router
                </p>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-900/50 inline-block">
                  {entry.result.rt}
                </span>
              </div>
              {entry.result.sql && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> SQL
                  </p>
                  <pre className="text-[12px] font-mono text-blue-300 bg-blue-950/30 p-4 rounded-xl border border-blue-900/40 whitespace-pre-wrap break-all leading-relaxed">
                    {entry.result.sql}
                  </pre>
                </div>
              )}
              {entry.result.db && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Raw Output
                  </p>
                  <pre className="text-[12px] font-mono text-orange-200 bg-orange-950/30 p-4 rounded-xl border border-orange-900/40 whitespace-pre-wrap break-all max-h-60 overflow-y-auto leading-relaxed">
                    {JSON.stringify(entry.result.db, null, 2)}
                  </pre>
                </div>
              )}
              {entry.result.doc && entry.result.doc.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Vector Context
                  </p>
                  <div className="flex flex-col gap-2">
                    {entry.result.doc.map((chunk, i) => (
                      <div key={i} className="bg-purple-950/30 p-4 rounded-xl border border-purple-900/40">
                        <p className="text-[12px] font-mono text-purple-200/90 whitespace-pre-wrap leading-relaxed">{chunk}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Visible chat thread
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  // LLM message history (plain text, no chart JSON) — sent as context
  const messages = useRef<Message[]>([]);

  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const txtRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const session = useRef<SessionData>({ tables: [], txtText: null });
  const [loadedTables, setLoadedTables] = useState<{ fileName: string; tableName: string }[]>([]);
  const [hasData, setHasData] = useState(false);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  // Cleanup DuckDB on unmount
  useEffect(() => {
    return () => {
      session.current.tables.forEach(async t => {
        await t.conn?.close?.();
        await t.instance?.terminate?.();
      });
    };
  }, []);

  const removeTable = useCallback(async (tableName: string) => {
    const target = session.current.tables.find(t => t.tableName === tableName);
    if (target) {
      await target.conn?.close?.();
      await target.instance?.terminate?.();
      session.current.tables = session.current.tables.filter(t => t.tableName !== tableName);
      const updated = session.current.tables.map(t => ({ fileName: t.fileName, tableName: t.tableName }));
      setLoadedTables([...updated]);
      setHasData(updated.length > 0 || !!session.current.txtText);
    }
  }, []);

  const clearConversation = useCallback(() => {
    setChatHistory([]);
    messages.current = [];
    setErr(null);
  }, []);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    const csvFiles = csvRef.current?.files ? Array.from(csvRef.current.files) : [];
    const txtFile = txtRef.current?.files?.[0];
    if (csvFiles.length === 0 && !txtFile) {
      setUploadStatus('Please select at least one file to upload.');
      return;
    }
    setUploadLoading(true);
    setUploadStatus(null);
    try {
      for (let i = 0; i < csvFiles.length; i++) {
        const file = csvFiles[i];
        const tableName = toTableName(file.name);
        console.log(`[Upload] Processing "${file.name}" → table: "${tableName}"`);
        const existing = session.current.tables.find(t => t.tableName === tableName);
        if (existing) {
          await existing.conn?.close?.();
          await existing.instance?.terminate?.();
          session.current.tables = session.current.tables.filter(t => t.tableName !== tableName);
        }
        setUploadStatus(`⚙️ Loading ${file.name} into DuckDB (${i + 1}/${csvFiles.length})...`);
        const csvText = await file.text();
        const table = await initDuckDBTable(csvText, file.name);
        session.current.tables.push(table);
        console.log(`[Upload] ✅ "${tableName}" ready. Total: ${session.current.tables.length}`);
        setLoadedTables([...session.current.tables.map(t => ({ fileName: t.fileName, tableName: t.tableName }))]);
        setHasData(true);
      }
      if (txtFile) {
        const lowerDocName = txtFile.name.toLowerCase();
        if (lowerDocName.endsWith('.pdf')) {
          setUploadStatus('⚙️ Parsing PDF in-browser...');
          if (!(window as any).pdfjsLib) {
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
              s.onload = resolve; s.onerror = reject;
              document.head.appendChild(s);
            });
          }
          const lib = (window as any).pdfjsLib;
          lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          const pdf = await lib.getDocument({ data: await txtFile.arrayBuffer() }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((item: any) => item.str).join(' ') + '\n';
          }
          session.current.txtText = text;
        } else if (lowerDocName.endsWith('.docx')) {
          setUploadStatus('⚙️ Parsing DOCX in-browser...');
          const arrayBuffer = await txtFile.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          session.current.txtText = result.value;
        } else {
          session.current.txtText = await txtFile.text();
        }
      }
      const updated = session.current.tables.map(t => ({ fileName: t.fileName, tableName: t.tableName }));
      setLoadedTables([...updated]);
      setHasData(updated.length > 0 || !!session.current.txtText);
      const parts: string[] = [];
      const lowerDocName = txtFile?.name.toLowerCase() ?? '';
      if (csvFiles.length > 0) parts.push(`${csvFiles.length} CSV table${csvFiles.length > 1 ? 's' : ''}`);
      if (txtFile) parts.push(lowerDocName.endsWith('.pdf') ? 'PDF context' : lowerDocName.endsWith('.docx') ? 'DOCX context' : 'text context');
      setUploadStatus(`✅ ${parts.join(' & ')} loaded. Ready to query.`);
      if (csvRef.current) csvRef.current.value = '';
      if (txtRef.current) txtRef.current.value = '';
    } catch (e: any) {
      setUploadStatus('❌ Error: ' + e.message);
    } finally {
      setUploadLoading(false);
    }
  }, []);

  // ── Ask ────────────────────────────────────────────────────────────────────
  const ask = useCallback(async () => {
    const query = q.trim();
    if (!query || loading) return;
    if (session.current.tables.length === 0 && !session.current.txtText) {
      setErr('No dataset loaded. Please upload a CSV and/or Document file first.');
      return;
    }
    setQ('');
    setLoading(true);
    setErr(null);
    try {
      const combinedSchema = session.current.tables.length > 0
        ? session.current.tables.map(t => t.schema).join('\n\n')
        : null;

      // Step 1: routing + SQL gen + RAG
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, schema: combinedSchema, txtContent: session.current.txtText ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');

      // Step 2: run SQL in DuckDB WASM
      let dbRows: any = null;
      let finalSql = data.sql ?? null;
      if (data.sql && session.current.tables.length > 0) {
        const { rows } = await runQueryAcrossTables(session.current.tables, data.sql);
        dbRows = rows;
        const isSumNull = dbRows?.length === 1 && Object.values(dbRows[0])[0] === null;
        const isEmpty = Array.isArray(dbRows) && dbRows.length === 0;
        if (dbRows?.error || isSumNull || isEmpty) {
          const reason = dbRows?.error || (isEmpty ? 'Empty result set' : 'NULL sum — no matches');
          const fixRes = await fetch('/api/fix-sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, schema: combinedSchema, badSql: data.sql, errMsg: reason }),
          });
          const fixData = await fixRes.json();
          if (fixData.sql) {
            finalSql = fixData.sql;
            const { rows: retryRows } = await runQueryAcrossTables(session.current.tables, fixData.sql);
            dbRows = retryRows;
          }
        }
      }

      // Step 3: synthesis — send conversation history for context
      const synthRes = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: query,
          dbRows,
          docChunks: data.doc ?? null,
          evidence: data.evidence ?? data.doc ?? null,
          // Send last MAX_HISTORY_TURNS turns (each turn = 1 user + 1 assistant = 2 messages)
          history: messages.current.slice(-(MAX_HISTORY_TURNS * 2)),
        }),
      });
      const synthData = await synthRes.json();

      const newResult: Result = {
        ans: synthData.ans,
        db: dbRows,
        doc: data.doc ?? null,
        rt: data.rt,
        sql: finalSql,
        verification: synthData.verification,
      };

      // Add to visible chat thread
      setChatHistory(prev => [...prev, { question: query, result: newResult }]);

      // Add to LLM history — strip chart JSON from assistant message to save tokens
      const { cleanAns } = parseChart(synthData.ans);
      messages.current = [
        ...messages.current,
        { role: 'user', content: query },
        { role: 'assistant', content: cleanAns },
      ];
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, loading]);

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center px-4 py-16 font-sans relative overflow-x-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl flex flex-col gap-10 z-10">

        {/* Header */}
        <div className="text-center space-y-4 pt-10">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 mb-2 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-[11px] font-bold text-slate-300 tracking-widest uppercase">Agentic Intelligence</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight flex items-center justify-center gap-4">
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">DataTalk</span>
            Agent
          </h1>
          <p className="text-slate-400 mt-6 text-base max-w-xl mx-auto leading-relaxed">
            Upload multiple datasets. The AI Agent builds a SQL engine per table and vector memory for documents — with full conversation memory.
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`h-2 w-2 rounded-full transition-all ${hasData ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-slate-600'}`} />
            <span className={`text-xs font-semibold tracking-wide ${hasData ? 'text-emerald-400' : 'text-slate-500'}`}>
              {hasData ? `Session active — ${loadedTables.length} table${loadedTables.length !== 1 ? 's' : ''} loaded` : 'No data loaded — upload to begin'}
            </span>
          </div>
        </div>

        {/* Ingest Panel */}
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2rem] border border-slate-800/80 p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-80" />
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-5 h-5 text-blue-400" />
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em]">Ingest Context Layer</h2>
          </div>
          <p className="text-[11px] text-slate-500 mb-6 ml-8">
            Files load directly into browser memory — nothing stored on any server. Select multiple CSVs to query across tables.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="group border-2 border-dashed border-slate-700/80 hover:border-blue-500/50 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-950/40 hover:bg-slate-900/80 transition-all min-h-[160px] relative overflow-hidden">
              <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Server className="w-8 h-8 text-slate-500 group-hover:text-blue-400 transition-colors mb-3" />
              <p className="text-sm font-semibold text-slate-300 mb-1">Database Upload (CSV)</p>
              <p className="text-[10px] text-slate-500 mb-3">Multiple files supported</p>
              <input type="file" accept=".csv" multiple ref={csvRef} className="z-10 text-xs text-slate-400 w-[200px] file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-[11px] file:font-semibold file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 cursor-pointer" />
            </div>
            <div className="group border-2 border-dashed border-slate-700/80 hover:border-purple-500/50 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-950/40 hover:bg-slate-900/80 transition-all min-h-[160px] relative overflow-hidden">
              <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <FileText className="w-8 h-8 text-slate-500 group-hover:text-purple-400 transition-colors mb-3" />
              <p className="text-sm font-semibold text-slate-300 mb-3">Document Upload (PDF/DOCX/TXT)</p>
              <input type="file" accept=".pdf,.docx,.txt,.md" ref={txtRef} className="z-10 text-xs text-slate-400 w-[200px] file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-[11px] file:font-semibold file:bg-purple-500/10 file:text-purple-400 hover:file:bg-purple-500/20 cursor-pointer" />
            </div>
          </div>

          {loadedTables.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {loadedTables.map(t => (
                <div key={t.tableName} className="flex items-center gap-2 bg-blue-950/50 border border-blue-800/60 rounded-full px-3 py-1.5 text-[11px] font-semibold text-blue-300">
                  <Table2 className="w-3 h-3" />
                  <span className="font-mono">{t.tableName}</span>
                  <span className="text-slate-500 text-[10px]">({t.fileName})</span>
                  <button onClick={() => removeTable(t.tableName)} className="ml-1 text-slate-500 hover:text-rose-400 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-slate-800/80">
            <p className={`text-sm font-medium ${uploadStatus?.startsWith('✅') ? 'text-emerald-400' : uploadStatus?.startsWith('❌') ? 'text-rose-400' : uploadStatus?.startsWith('⚙️') ? 'text-blue-400' : 'text-slate-500'}`}>
              {uploadStatus || 'Files are processed locally — no server storage.'}
            </p>
            <button onClick={handleUpload} disabled={uploadLoading} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 border border-indigo-500 disabled:border-slate-700 text-white text-xs font-bold uppercase tracking-widest rounded-xl px-8 py-3 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 min-w-[200px] justify-center">
              <UploadCloud className="w-4 h-4" />
              {uploadLoading ? 'Loading into Browser...' : 'Load into Browser'}
            </button>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-slate-800/80 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500 opacity-60" />

          {/* Panel header */}
          <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <BrainCircuit className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-[0.2em]">Synthesis Engine</h2>
              {chatHistory.length > 0 && (
                <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                  {chatHistory.length} turn{chatHistory.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {chatHistory.length > 0 && (
              <button onClick={clearConversation} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-rose-400 uppercase tracking-widest transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-8 px-8 py-6 min-h-[220px]">
            {!hasData && chatHistory.length === 0 && (
              <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl px-5 py-3 text-xs text-amber-400 font-medium flex items-center gap-2">
                ⚠️ No dataset loaded. Upload CSV files and/or a TXT/PDF document above before asking questions.
              </div>
            )}

            {hasData && chatHistory.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-600">
                <BrainCircuit className="w-10 h-10 opacity-20" />
                <p className="text-sm font-medium">Ask your first question below</p>
                {loadedTables.length > 1 && (
                  <p className="text-xs text-center text-slate-600">
                    Tables: {loadedTables.map(t => (
                      <code key={t.tableName} className="mx-0.5 bg-slate-800 text-slate-400 px-1 rounded">{t.tableName}</code>
                    ))}
                  </p>
                )}
              </div>
            )}

            {chatHistory.map((entry, i) => <ChatTurn key={i} entry={entry} />)}

            {loading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <BrainCircuit className="w-4 h-4 text-blue-300" />
                </div>
                <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl rounded-tl-sm px-6 py-4 flex items-center gap-3">
                  <Activity className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span className="text-indigo-300 font-bold tracking-widest uppercase text-[10px]">Processing Pipeline...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {err && (
            <div className="mx-8 mb-4 bg-rose-950/30 border-l-[3px] border-rose-500 rounded-r-xl px-5 py-4 flex items-start gap-3">
              <span className="text-rose-400 shrink-0">⚠️</span>
              <p className="text-rose-200 text-sm font-medium leading-relaxed">{err}</p>
            </div>
          )}

          {/* Input */}
          <div className="px-8 pb-8 pt-2 border-t border-slate-800/80">
            {loadedTables.length > 1 && (
              <div className="mb-3 bg-blue-950/30 border border-blue-800/50 rounded-xl px-4 py-2.5 text-xs text-blue-300 font-medium flex items-start gap-2">
                <Table2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  <strong>{loadedTables.length} tables loaded.</strong> Reference by name:{' '}
                  {loadedTables.map(t => <code key={t.tableName} className="mx-0.5 bg-slate-800 px-1 rounded">{t.tableName}</code>)}
                </span>
              </div>
            )}
            <div className="flex gap-3 items-end">
              <textarea
                className="flex-1 bg-slate-950/80 border border-slate-700 rounded-2xl px-5 py-4 text-[15px] resize-none focus:outline-none focus:ring-2 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-slate-100 placeholder-slate-600 disabled:opacity-50 transition-all shadow-inner leading-relaxed"
                rows={2}
                placeholder={
                  !hasData ? 'Upload a dataset first...' :
                  chatHistory.length > 0 ? 'Ask a follow-up question...' :
                  'Ask anything about your data...'
                }
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={onKey}
                disabled={loading || !hasData}
              />
              <button
                onClick={ask}
                disabled={!q.trim() || loading || !hasData}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed border border-blue-500 disabled:border-slate-700 text-white text-xs font-bold uppercase tracking-widest rounded-xl px-7 py-4 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 shrink-0"
              >
                {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? 'Thinking...' : 'Ask'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
