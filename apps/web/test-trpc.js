import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import fetch from 'node-fetch';

globalThis.fetch = fetch;

const client = createTRPCClient({
    links: [
        httpBatchLink({
            url: 'http://localhost:3001/trpc',
            transformer: superjson,
            headers: () => ({ Authorization: 'Station e1207fa6bd707904e23dd181c46b2fdbd65326aef70b4dd036ebc2987a67e467' }),
        }),
    ],
});

async function main() {
    try {
        const res = await client.bin.start.mutate({ qrCode: 'BIN-HEART-001' });
        console.log("Success:", res);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main();
