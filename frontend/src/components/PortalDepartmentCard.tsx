'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2 } from 'lucide-react';
import DepartmentStatsPie from '@/components/DepartmentStatsPie';
import { STATUS_ORDER } from '@/lib/departmentStats';

const API_URL = '/api';

interface PortalDeptStats {
  group_key: string;
  stats: { total: number; byStatus: Record<string, number>; byYear: Record<string, number> };
  projects: { id: string; title: string; status: string }[];
}

export default function PortalDepartmentCard() {
  const [data, setData] = useState<PortalDeptStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('portal_token');
    if (!token) return;
    axios
      .get<PortalDeptStats>(`${API_URL}/portal/stats/my-department`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { range: 'all', include_completed: true },
      })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="mb-4">
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="mb-4 border-emerald-500/30 bg-emerald-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-emerald-600" />
          我所在分厂 · {data.group_key}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div>
          <p className="text-3xl font-bold text-emerald-700">{data.stats.total}</p>
          <p className="text-xs text-muted-foreground">与我相关的项目</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {STATUS_ORDER.map((st) => (
              <Badge key={st} variant="secondary" className="text-[10px]">
                {st} {data.stats.byStatus[st] ?? 0}
              </Badge>
            ))}
          </div>
        </div>
        <DepartmentStatsPie byStatus={data.stats.byStatus} size={120} />
      </CardContent>
    </Card>
  );
}
