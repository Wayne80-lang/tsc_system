
export interface DashboardStats {
    pending_systems: number;
    overdue_requests: number;
    reviewed_today: number;
    total_history: number;
    approved_history: number;
    rejected_history: number;
    priority_requests?: number; // Optional as not used by all roles
}

export type ProcessStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'sent_admin';
export type AccessRequestStatus = 'pending_hod' | 'rejected_hod' | 'pending_ict' | 'rejected_ict' | 'pending_sysadmin' | 'rejected_sysadmin' | 'approved' | 'revoked';

export interface RequestedSystem {
    id: number;
    system: string;
    system_display: string;
    level_of_access?: string;
    hod_status: ProcessStatus;
    ict_status: ProcessStatus;
    sysadmin_status: ProcessStatus;
    system_admin?: number; // ID
    directorate?: number; // ID
    current_stage?: string;
    days_open?: number;
    is_overdue?: boolean;
    pending_approver?: string;
}

export interface AccessRequest {
    id: number;
    requester_name: string;
    requester_email: string;
    tsc_no: string;
    designation: string;
    department?: string; // or directorate name
    directorate_name?: string; // From serializer
    request_type: 'new' | 'modify' | 'deactivate';
    status: AccessRequestStatus;
    submitted_at: string;
    requested_systems: RequestedSystem[];
}
