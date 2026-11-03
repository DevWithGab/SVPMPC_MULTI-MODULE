export const monthLabel = (key) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
};

export const isoDate = (value) => (value ? new Date(value).toISOString().split('T')[0] : '');
