require("dotenv").config();

const fetch = require("node-fetch");
const moment = require("moment");
// const NodeCache = require("node-cache");
const Discord = require("discord.js");
const ethers = require("ethers");

const discordClient = new Discord.Client();

let discordChannel;

let lastPollTimeStamp = moment().unix();

discordClient.login(process.env.DISCORD_BOT_TOKEN);

discordClient.on("ready", async function () {
  console.log(`Discord Bot is ready! Logged in as ${discordClient.user.tag}!`);
  discordChannel = await discordClient.channels.fetch(
    process.env.DISCORD_CHANNEL_ID
  );
  console.log(`Discord Bot has started in channel ${discordChannel.name}!`);
  initPoller();
});

function initPoller() {
  setInterval(
    async () => {
      if (!discordChannel) return;
      console.log("\nChecking for new OpenSea sales...");
      const events = await getOpenSeaEvents().catch((err) =>
        console.log(`OpenSea:getOpenSeaEvents:err>`, err)
      );

      if (events && events.asset_events && events.asset_events.length) {
        console.log(
          `Congrats! Total new sales: (${events.asset_events.length})`
        );
        for (const sale of events.asset_events.reverse()) {
          const message = buildDiscordMessage(sale);
          discordChannel
            .send(message)
            .catch((err) => console.log("Discord:channel:send:err>", err));
        }
      } else {
        console.log("No OpenSea sales!");
      }
      lastPollTimeStamp = moment.unix();
    },
    process.env.POLLING_INTERVAL_SECONDS
      ? parseInt(process.env.POLLING_INTERVAL_SECONDS)
      : 60000
  );
}

const getOpenSeaEvents = async () => {
  const params = new URLSearchParams({
    offset: "0",
    event_type: "successful",
    only_opensea: "false",
    occurred_after: lastPollTimeStamp,
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
