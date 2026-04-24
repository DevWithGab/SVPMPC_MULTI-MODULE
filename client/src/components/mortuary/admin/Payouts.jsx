import React from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';

const Payouts = ({ payouts, setIsAddPayoutOpen }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Payout Disbursements</h2>
          <p className="text-slate-500 mt-1">Track funds released to beneficiaries</p>
        </div>
        <Button className="bg-emerald-800 hover:bg-emerald-900 text-white" onClick={() => setIsAddPayoutOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Record Payout
        </Button>
      </div>

      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40">
        <CardHeader>
          <CardTitle className="text-lg">Payout History</CardTitle>
          <CardDescription>A record of all insurance payments issued.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Beneficiary</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-slate-600 font-medium">{p.payout_date}</TableCell>
                  <TableCell className="font-semibold text-slate-900">{p.member_name}</TableCell>
                  <TableCell>{p.beneficiary}</TableCell>
                  <TableCell className="font-bold text-emerald-800">₱{p.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-200 text-slate-500 uppercase text-[10px] tracking-widest">{p.payment_method}</Badge>
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

export default Payouts;
