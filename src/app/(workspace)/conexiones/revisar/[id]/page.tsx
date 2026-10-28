import { requireUser } from '@/lib/session';
import { proposalForUser } from '@/modules/mcp/data';
import { notFound } from 'next/navigation';
import { McpReview } from '@/components/mcp/review';
import '../../connections.css';
export default async function Review({params}:{params:Promise<{id:string}>}) {
  const user=await requireUser();let proposal;
  try{proposal=await proposalForUser((await params).id,user.id);}catch{notFound();}
  return <McpReview proposal={proposal}/>;
}
