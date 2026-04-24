import React from 'react';

export const Table = ({ children, className = '', ...props }) => (
  <table className={`w-full ${className}`} {...props}>
    {children}
  </table>
);

export const TableHeader = ({ children, className = '', ...props }) => (
  <thead className={className} {...props}>
    {children}
  </thead>
);

export const TableBody = ({ children, className = '', ...props }) => (
  <tbody className={className} {...props}>
    {children}
  </tbody>
);

export const TableRow = ({ children, className = '', ...props }) => (
  <tr className={className} {...props}>
    {children}
  </tr>
);

export const TableHead = ({ children, className = '', ...props }) => (
  <th className={`px-6 py-3 text-left ${className}`} {...props}>
    {children}
  </th>
);

export const TableCell = ({ children, className = '', ...props }) => (
  <td className={`px-6 py-4 ${className}`} {...props}>
    {children}
  </td>
);