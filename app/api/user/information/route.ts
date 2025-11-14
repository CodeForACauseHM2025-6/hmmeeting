// src/app/api/user/information/route.ts
// API endpoint to get the user's information. 

import { auth } from "@/auth";
import { prisma } from "@/src/server/db"; 

export async function GET(request: Request) {
    const session = await auth(); // Gets the user's session 

    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }
    const user = await prisma.user.findUnique({ // return all the user's information
        where: { email: session.user?.email },
    });
    return new Response(JSON.stringify(user), { status: 200 }); // return the user's information in JSON format
}