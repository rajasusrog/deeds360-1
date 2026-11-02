import React from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';

import SuperAdminWorkspace from '../components/workspaces/SuperAdminWorkspace';
import AdminWorkspace from '../components/workspaces/AdminWorkspace';
import LawyerWorkspace from '../components/workspaces/LawyerWorkspace';
import DocumentWriterWorkspace from '../components/workspaces/DocumentWriterWorkspace';
import BrokerWorkspace from '../components/workspaces/BrokerWorkspace';
import ClientWorkspace from '../components/workspaces/ClientWorkspace';
import AuditorWorkspace from '../components/workspaces/AuditorWorkspace';

interface DashboardProps {
  onNavigateToDraft: () => void;
  currentUserRole: UserRole;
}

export default function Dashboard({ onNavigateToDraft, currentUserRole }: DashboardProps) {
  const { effectiveRole } = useApp();
  const roleToRender = effectiveRole || currentUserRole;

  switch (roleToRender) {
    case 'Super Admin':
      return <SuperAdminWorkspace />;

    case 'Admin':
      return <AdminWorkspace />;

    case 'Lawyer':
      return <LawyerWorkspace />;

    case 'Document Writer':
    case 'Data Entry Operator':
      return <DocumentWriterWorkspace />;

    case 'Broker':
      return <BrokerWorkspace />;

    case 'Client':
      return <ClientWorkspace />;

    case 'Auditor':
      return <AuditorWorkspace />;

    default:
      return <DocumentWriterWorkspace />;
  }
}
