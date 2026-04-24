import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';

const Claims = ({ claims, updateClaimStatus }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Benefit Claims</h2>
          <p className="text-slate-500 mt-1">Review and process insurance benefit requests</p>
        </div>
      </div>

      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40">
        <CardHeader>
          <CardTitle className="text-lg">Active Claims List</CardTitle>
          <CardDescription>All submitted death benefits and processing status.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Filed</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Claimant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell className="text-slate-600">{claim.filed_date}</TableCell>
                  <TableCell className="font-semibold text-slate-900">{claim.member_name}</TableCell>
                  <TableCell>{claim.claimant_name}</TableCell>
                  <TableCell>
                    <Badge variant={claim.status === 'Approved' ? 'default' : claim.status === 'Rejected' ? 'destructive' : 'secondary'}>
                      {claim.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                       {claim.status === 'Pending' && (
                         <Button variant="ghost" size="sm" className="text-emerald-700 font-bold" onClick={() => updateClaimStatus(claim.id, 'Approved')}>Approve</Button>
                       )}
                       <Button variant="ghost" size="sm" className="text-slate-500">View</Button>
                    </div>
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
};

export default Claims;
