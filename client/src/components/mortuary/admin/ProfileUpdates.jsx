import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';

const ProfileUpdates = ({ profileUpdates, updateProfileStatus }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold text-slate-900">Profile Updates</h2>
    </div>

    <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40">
      <CardHeader>
        <CardTitle className="text-lg">Pending Update Requests</CardTitle>
        <CardDescription>Review and approve member profile updates.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Requested Changes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profileUpdates.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-slate-600">{u.request_date}</TableCell>
                <TableCell className="font-semibold text-slate-900">{u.member_name}</TableCell>
                <TableCell>
                  <pre className="text-xs bg-slate-50 border border-slate-100 text-slate-700 p-2 rounded max-w-xs overflow-auto">
                    {(() => {
                      try {
                         return JSON.stringify(JSON.parse(u.requested_changes), null, 2);
                      } catch (e) {
                        return u.requested_changes;
                      }
                    })()}
                  </pre>
                </TableCell>
                <TableCell>
                  <Badge variant={u.status === 'Approved' ? 'default' : u.status === 'Rejected' ? 'destructive' : 'secondary'}>
                    {u.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {u.status === 'Pending' && (
                    <div className="flex justify-end space-x-2">
                      <Button variant="ghost" size="sm" className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50" onClick={() => updateProfileStatus(u.id, 'Approved')}>Approve</Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => updateProfileStatus(u.id, 'Rejected')}>Reject</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardContent>
    </Card>
  </div>
);

export default ProfileUpdates;
