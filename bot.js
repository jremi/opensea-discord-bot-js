require("dotenv").config();

const fetch = require("node-fetch");
const NodeCache = require("node-cache");
const Discord = require("discord.js");
const ethers = require("ethers");

const openSeaEventsCache = new NodeCache({ stdTTL: 7200 }); // 2 hours

const discordClient = new Discord.Client();

let discordChannel;

discordClient.login(process.env.DISCORD_BOT_TOKEN);

discordClient.on("ready", async function () {
  console.log(`Discord Bot is ready! Logged in as ${discordClient.user.tag}!`);
  discordChannel = await discordClient.channels.fetch(
    process.env.DISCORD_CHANNEL_ID
  );
  console.log(`Discord Bot has started in channel ${discordChannel.name}!`);
});

const getOpenSeaEvents = async () => {
  const seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 3600;
  const hoursAgo = Math.round(new Date().getTime() / 1000) - seconds;
  const params = new URLSearchParams({
    offset: "0",
    event_type: "successful",
    only_opensea: "false",
    occurred_after: hoursAgo.toString(),
    collection_slug: process.env.COLLECTION_SLUG,
  });
  return await fetch("https://api.opensea.io/api/v1/events?" + params).then(
    (resp) => resp.json()
  );
};

const buildDiscordMessage = (sale) =>
  new Discord.MessageEmbed()
    .setColor("#0099ff")
    .setTitle(sale.asset.name + " sold!")
    .setURL(sale.asset.permalink)
    .setAuthor(
      "OpenSea Bot",
      "https://files.readme.io/566c72b-opensea-logomark-full-colored.png",
      "https://opensea.io/"
    )
    .setThumbnail(sale.asset.collection.image_url)
    .addFields(
      { name: "Name", value: sale.asset.name },
      {
        name: "Amount",
        value: `${ethers.utils.formatEther(sale.total_price || "0")}${
          ethers.constants.EtherSymbol
        }`,
      },
      { name: "Buyer", value: sale.winner_account.address },
      { name: "Seller", value: sale.seller.address }
    )
    .setImage(sale.asset.image_url)
    .setTimestamp(Date.parse(`${sale.created_date}Z`))
    .setFooter(
      "Sold on OpenSea",
      "https://files.readme.io/566c72b-opensea-logomark-full-colored.png"
    );

setInterval(
  async () => {
    if (!discordChannel) return;
    const events = await getOpenSeaEvents();
    if (events && events.asset_events) {
      for (const sale of events.asset_events.reverse()) {
        const eventAlreadyCached = openSeaEventsCache.get(sale.id);
        if (eventAlreadyCached) {
          console.log(`Sale already cached/posted:`, sale.id, sale.asset.name);
          continue;
        }
        const message = buildDiscordMessage(sale);
        discordChannel
          .send(message)
          .catch((err) =>
            console.log("Discord:channel:send:msg>", err.message)
          );
        openSeaEventsCache.set(sale.id, sale);
        console.log(
          `Sale just cached/posted to Discord!`,
          sale.id,
          sale.asset.name
        );
      }
    }
  },
  process.env.POLLING_INTERVAL_SECONDS
    ? parseInt(process.env.POLLING_INTERVAL_SECONDS)
    : 60000
);
