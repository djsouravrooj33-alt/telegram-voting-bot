const BOT_TOKEN = "8802767588:AAEYV_75D32d2_S2aN2qJAuh6PNHnhYLSGQ";

const OWNER_ID = 8145485145;
const CHANNEL_ID = -1003968965177;

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function tg(method, data) {
    return fetch(`${API}/${method}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });
}

async function checkJoin(userId) {
    const res = await fetch(`${API}/getChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: CHANNEL_ID,
            user_id: userId
        })
    });

    const data = await res.json();

    return [
        "member",
        "administrator",
        "creator"
    ].includes(data.result?.status);
}

export default {
    async fetch(req, env) {

        if (req.method !== "POST")
            return new Response("BOT ONLINE");

        const update = await req.json();

        if (update.message) {

            const msg = update.message;
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const text = msg.text || "";

            if (text.startsWith("/start")) {

                await tg("sendMessage", {
                    chat_id: chatId,
                    text: "Voting Bot Active"
                });

            }

            else if (
                userId == OWNER_ID &&
                text.startsWith("/add ")
            ) {

                const name = text.replace("/add ", "");

                const pollId = Date.now().toString();

                await env.VOTES.put(
                    `poll_${pollId}`,
                    JSON.stringify({
                        name,
                        votes: 0
                    })
                );

                await tg("sendMessage", {
                    chat_id: CHANNEL_ID,
                    text: `📢 ${name}`,
                    reply_markup: {
                        inline_keyboard: [[
                            {
                                text: "🗳 Vote",
                                callback_data: `vote_${pollId}`
                            }
                        ]]
                    }
                });

                await tg("sendMessage", {
                    chat_id: chatId,
                    text: "Added"
                });
            }

            else if (
                userId == OWNER_ID &&
                text.startsWith("/addvote")
            ) {

                const args = text.split(" ");

                const target = args[1];
                const count = Number(args[2]);

                let current =
                    Number(
                        await env.VOTES.get(
                            `user_${target}`
                        )
                    ) || 0;

                current += count;

                await env.VOTES.put(
                    `user_${target}`,
                    current.toString()
                );

                await tg("sendMessage", {
                    chat_id: chatId,
                    text: "Vote Added"
                });
            }

            else if (
                userId == OWNER_ID &&
                text.startsWith("/removevote")
            ) {

                const args = text.split(" ");

                const target = args[1];
                const count = Number(args[2]);

                let current =
                    Number(
                        await env.VOTES.get(
                            `user_${target}`
                        )
                    ) || 0;

                current -= count;

                if (current < 0)
                    current = 0;

                await env.VOTES.put(
                    `user_${target}`,
                    current.toString()
                );

                await tg("sendMessage", {
                    chat_id: chatId,
                    text: "Vote Removed"
                });
            }

        }

        if (update.callback_query) {

            const cb = update.callback_query;

            const userId = cb.from.id;

            const pollId =
                cb.data.replace("vote_", "");

            const joined =
                await checkJoin(userId);

            if (!joined) {

                await tg("answerCallbackQuery", {
                    callback_query_id: cb.id,
                    text: "Join Channel First",
                    show_alert: true
                });

                return new Response("OK");
            }

            const voted =
                await env.VOTES.get(
                    `voted_${pollId}_${userId}`
                );

            if (
                voted &&
                userId != OWNER_ID
            ) {

                await tg("answerCallbackQuery", {
                    callback_query_id: cb.id,
                    text: "Already Voted",
                    show_alert: true
                });

                return new Response("OK");
            }

            let poll =
                JSON.parse(
                    await env.VOTES.get(
                        `poll_${pollId}`
                    )
                );

            poll.votes++;

            await env.VOTES.put(
                `poll_${pollId}`,
                JSON.stringify(poll)
            );

            await env.VOTES.put(
                `voted_${pollId}_${userId}`,
                "1"
            );

            await tg("answerCallbackQuery", {
                callback_query_id: cb.id,
                text: "Vote Added"
            });

            await tg("editMessageText", {
                chat_id: cb.message.chat.id,
                message_id: cb.message.message_id,
                text: `📢 ${poll.name}\n\nVotes: ${poll.votes}`,
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: `🗳 Vote (${poll.votes})`,
                            callback_data: `vote_${pollId}`
                        }
                    ]]
                }
            });

        }

        return new Response("OK");
    }
      }
