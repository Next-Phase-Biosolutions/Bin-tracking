import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import fetch from 'node-fetch';

globalThis.fetch = fetch;

const client = createTRPCClient({
    links: [
        httpBatchLink({
            url: 'http://localhost:3001/trpc',
            transformer: superjson,
            headers: () => ({ Authorization: 'Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6ImJiNjJmODNiLTNjMTAtNDcxZC1iYTg5LWNjOGMzNWMxZDkxYSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3NhcWt5aWlsdWJsdXR3dXN3dWxrLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI1ZWZhOGE1ZC02MTQ3LTQwYzMtOWIyOS1mYTkyYTc1ODQ0MmEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzcyMDA4Mzg4LCJpYXQiOjE3NzIwMDQ3ODgsImVtYWlsIjoiZHJpdmVyMUBiaW50cmFja2VyLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJKb2huIERyaXZlciJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzcyMDA0Nzg4fV0sInNlc3Npb25faWQiOiJkNjU2NjRmNi0zZDBhLTRiODEtODBmNi1kM2Y3ZTU3MjVhZWIiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.CtKiIYmhueTpIyDO0g6863z2x_qXDiEkSYj_mrUvAzvU9gy-Skhl9-QiR7YLB9qcMoan1BdjcYTQXi2JYHuLFw' }),
        }),
    ],
});

async function main() {
    try {
        // Find the active cycle for BIN-HEART-001 by querying the DB directly first
        const binDetails = await client.bin.getByQrCode.query({ qrCode: 'BIN-HEART-001' });
        console.log("Active cycle:", binDetails.activeCycle);
        if (binDetails.activeCycle) {
            const res = await client.cycle.deliver.mutate({ 
                cycleId: binDetails.activeCycle.id,
                destinationId: 'cmlrrc3f30004ebucz781y7uo'
            });
            console.log("Success:", res);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main();
