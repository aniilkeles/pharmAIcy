import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Package, Clock, AlertTriangle, ClipboardList, CheckCircle, Timer } from 'lucide-react'
import { useAPI } from '@/hooks/useAPI'
import { useStore } from '@/store/useStore'
import { useNotifications } from '@/hooks/useNotifications'
import KPICard from '@/components/dashboard/KPICard'
import SalesChart from '@/components/dashboard/SalesChart'
import DecisionPanel from '@/components/dashboard/DecisionPanel'
import ChatPanel from '@/components/chat/ChatPanel'
import EmptyState from '@/components/ui/EmptyState'

function Dashboard() {
  const { fetchDashboard, fetchDecisions, fetchAgentStatus } = useAPI()
  const { dashboardData, decisionsData } = useStore()
  useNotifications()

  useEffect(() => {
    fetchDashboard()
    fetchDecisions()
    fetchAgentStatus()
  }, [])

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!dashboardData.has_data) {
    return <EmptyState message="No pharmacy data yet" sub="Upload a CSV file to start analyzing your pharmacy" />
  }

  const sales = dashboardData.sales || {}
  const rxStats = dashboardData.prescription_stats || {}

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value={`${(sales.total_revenue || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}₺`}
          sub={`This week: ${(sales.weekly_revenue || 0).toFixed(2)}₺`}
          icon={TrendingUp}
          color="accent"
          delay={0}
        />
        <KPICard
          title="Products"
          value={dashboardData.product_count}
          sub="Total in inventory"
          icon={Package}
          color="blue"
          delay={0.04}
        />
        <KPICard
          title="Low Stock"
          value={dashboardData.low_stock_count}
          sub="Below threshold"
          icon={AlertTriangle}
          color="warning"
          delay={0.08}
        />
        <KPICard
          title="Expiring Soon"
          value={dashboardData.expiry_count}
          sub="Within 90 days"
          icon={Clock}
          color="danger"
          delay={0.12}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Today's Prescriptions"
          value={rxStats.today ?? 0}
          sub="Prescriptions today"
          icon={ClipboardList}
          color="accent"
          delay={0}
        />
        <KPICard
          title="Fulfillment Rate"
          value={`${rxStats.fulfillment_rate ?? 0}%`}
          sub="Qty dispensed vs requested"
          icon={CheckCircle}
          color="blue"
          delay={0.04}
        />
        <KPICard
          title="Pending"
          value={rxStats.pending ?? 0}
          sub="Awaiting dispensing"
          icon={Timer}
          color="warning"
          delay={0.08}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 flex flex-col gap-4">
          <SalesChart data={sales.daily_revenue || []} />
          <DecisionPanel decisions={decisionsData} />
        </div>
        <div className="h-[520px]">
          <ChatPanel />
        </div>
      </div>
    </motion.div>
  )
}

export default Dashboard
