import { useState } from 'react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import { DateRangePicker, rangeForLastDays } from '../components/DateRangePicker';
import { PatientAnalyticsTab } from '../components/PatientAnalyticsTab';
import { QueueAnalyticsTab } from '../components/QueueAnalyticsTab';
import { RevenueAnalyticsTab } from '../components/RevenueAnalyticsTab';
import { EmergencyAnalyticsTab } from '../components/EmergencyAnalyticsTab';
import type { AnalyticsDateRange } from '../api';

/** GET /reports (spec §40) — patient/queue/revenue/emergency analytics, tabbed by report type. */
export default function ReportsPage() {
  const [range, setRange] = useState<AnalyticsDateRange>(() => rangeForLastDays(30));

  return (
    <div className="min-w-0">
      <PageHeader
        title="Reports & Analytics"
        description="Trends and breakdowns across patients, queue, revenue and emergencies for the selected date range."
      />

      <DateRangePicker value={range} onChange={setRange} />

      <Tabs defaultValue="patients" className="mt-6">
        <TabsList>
          <TabsTrigger value="patients">Patient Analytics</TabsTrigger>
          <TabsTrigger value="queue">Queue Analytics</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analytics</TabsTrigger>
          <TabsTrigger value="emergency">Emergency Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="patients">
          <PatientAnalyticsTab range={range} />
        </TabsContent>
        <TabsContent value="queue">
          <QueueAnalyticsTab range={range} />
        </TabsContent>
        <TabsContent value="revenue">
          <RevenueAnalyticsTab range={range} />
        </TabsContent>
        <TabsContent value="emergency">
          <EmergencyAnalyticsTab range={range} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
