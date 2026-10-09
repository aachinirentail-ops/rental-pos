'use client';
import { useParams } from 'next/navigation';
import BillForm from '@/components/BillForm';

export default function EditBillPage() {
  const { id } = useParams();
  return <BillForm key={id} editId={id} />;
}
