import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Download, RefreshCw, Users, Printer } from 'lucide-react';
import { AppLayout } from '../../components/layout/AppLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';

const TABLES = [
  ...Array.from({ length: 6  }, (_, i) => ({ no: i + 1,  section: 'Section A', capacity: 4 })),
  ...Array.from({ length: 4  }, (_, i) => ({ no: i + 7,  section: 'Section B', capacity: 6 })),
  ...Array.from({ length: 4  }, (_, i) => ({ no: i + 11, section: 'Section C', capacity: 2 })),
  ...Array.from({ length: 2  }, (_, i) => ({ no: i + 15, section: 'VIP',       capacity: 8 })),
];

const SECTION_COLORS: Record<string, string> = {
  'Section A': 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400',
  'Section B': 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400',
  'Section C': 'bg-teal-500/10 border-teal-500/20 text-teal-700 dark:text-teal-400',
  'VIP':       'bg-violet-500/10 border-violet-500/20 text-violet-700 dark:text-violet-400',
};

const QrDisplay: React.FC<{ tableNo: number; size?: number }> = ({ tableNo, size = 120 }) => {
  const url = `${window.location.origin}/menu?table=${tableNo}`;
  // Use a public QR API
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=0f172a&qzone=1&format=png`;
  return (
    <img
      src={qrUrl}
      alt={`QR for Table ${tableNo}`}
      width={size}
      height={size}
      className="rounded-xl"
      loading="lazy"
    />
  );
};

const QRTablesPage: React.FC = () => {
  const [selected, setSelected] = useState<number | null>(null);
  const [section,  setSection]  = useState('All');

  const sections = ['All', 'Section A', 'Section B', 'Section C', 'VIP'];
  const filtered = section === 'All' ? TABLES : TABLES.filter(t => t.section === section);

  const selectedTable = TABLES.find(t => t.no === selected);

  const handlePrint = (tableNo: number) => {
    const url = `${window.location.origin}/menu?table=${tableNo}`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Table ${tableNo} QR Code</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;gap:16px;margin:0;}
      h2{font-size:24px;margin:0;}p{color:#666;margin:0;font-size:14px;}</style></head>
      <body>
        <h2>Table ${tableNo}</h2>
        <p>Scan to view menu & order</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=0f172a&qzone=2" width="300" height="300"/>
        <p style="font-size:12px;margin-top:8px;">${url}</p>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  return (
    <AppLayout title="QR Tables" subtitle="QR codes for table-side ordering">
      <div className="space-y-5 pb-6">

        {/* Section filter */}
        <div className="flex flex-wrap gap-2">
          {sections.map(s => (
            <button key={s} onClick={() => setSection(s)}
              className={cn('px-4 py-1.5 rounded-xl text-sm font-medium border transition-all',
                section === s
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800',
              )}>
              {s}
            </button>
          ))}
        </div>

        {/* QR Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((table, i) => (
            <motion.div key={table.no}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}>
              <Card className={cn(
                'flex flex-col items-center gap-3 p-4 cursor-pointer border-2 transition-all',
                selected === table.no
                  ? 'border-brand-500 shadow-lg shadow-brand-500/10'
                  : 'border-transparent hover:border-brand-300',
              )}
                onClick={() => setSelected(selected === table.no ? null : table.no)}>

                <div className="flex items-center justify-between w-full">
                  <span className="text-base font-bold text-surface-900 dark:text-surface-100">
                    Table {table.no}
                  </span>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-lg border', SECTION_COLORS[table.section])}>
                    {table.section === 'Section A' ? 'A' : table.section === 'Section B' ? 'B' : table.section === 'Section C' ? 'C' : 'VIP'}
                  </span>
                </div>

                <QrDisplay tableNo={table.no} size={100} />

                <div className="flex items-center gap-1 text-xs text-surface-400">
                  <Users size={11} />
                  {table.capacity} seats
                </div>

                <Button variant="ghost" size="xs" fullWidth icon={<Printer size={12} />}
                  onClick={e => { e.stopPropagation(); handlePrint(table.no); }}>
                  Print
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Selected table detail */}
        {selected && selectedTable && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <QrDisplay tableNo={selected} size={200} />
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-1">
                    Table {selected}
                  </h3>
                  <p className="text-surface-500 text-sm mb-1">{selectedTable.section} · {selectedTable.capacity} seats</p>
                  <p className="text-xs text-surface-400 mb-4 font-mono break-all">
                    {window.location.origin}/menu?table={selected}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <Button variant="primary" icon={<Printer size={14} />}
                      onClick={() => handlePrint(selected)}>
                      Print QR Code
                    </Button>
                    <Button variant="outline" icon={<Download size={14} />}
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(window.location.origin + '/menu?table=' + selected)}&bgcolor=ffffff&color=0f172a&qzone=2`;
                        a.download = `table-${selected}-qr.png`;
                        a.click();
                      }}>
                      Download PNG
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
};

export default QRTablesPage;
