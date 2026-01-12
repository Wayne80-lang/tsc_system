import React from 'react';
import { Button } from '@/components/ui/button';

interface PaginationControlsProps {
    currentPage: number;
    count: number;
    pageSize?: number;
    nextUrl: string | null;
    prevUrl: string | null;
    loading: boolean;
    onPageChange: (url: string | null, direction: 'next' | 'prev') => void;
}

export default function PaginationControls({
    currentPage,
    count,
    pageSize = 10,
    nextUrl,
    prevUrl,
    loading,
    onPageChange
}: PaginationControlsProps) {
    // If no records, or less than one page worth, and we are on page 1, strictly we might hide it.
    // But showing "Page 1 of 1" is fine too.
    const totalPages = Math.ceil(count / pageSize) || 1;

    return (
        <div className="bg-white border-t border-slate-100 p-4 rounded-b-xl shadow-sm flex justify-between items-center mt-[-1rem] z-10 relative">
            <div className="text-xs text-slate-500 font-medium">
                Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(prevUrl, 'prev')}
                    disabled={!prevUrl || loading}
                    className="text-xs h-8"
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(nextUrl, 'next')}
                    disabled={!nextUrl || loading}
                    className="text-xs h-8"
                >
                    Next
                </Button>
            </div>
        </div>
    );
}
