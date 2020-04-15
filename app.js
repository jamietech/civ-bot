const fs = require('fs');
const config = require('./config/config');
const Discord = require('discord.js');
const mc = require('minecraft-protocol');
const discordClient = new Discord.Client();
const dateFormat = require('dateformat');

let discordChannel;

discordClient.on('ready', async () => {
    discordChannel = discordClient.channels.cache.get(config.botChannel[""]);
    console.log(`Logged in to Discord as ${discordClient.user.tag}!`)
});

discordClient.login(config.botToken);

const formattingCodesRegex = /§[0-9a-fk-or]/gi;

function start() {
    const mcClient = mc.createClient({
        host: config.mcHost,
        port: config.mcPort,
        username: config.mcUsername,
        password: config.mcPassword,
        version: config.mcVersion
    });

    mcClient.on('chat', packet => {
        let msg = '';
        const json = JSON.parse(packet.message);

        if (json.text) {
            msg += json.text
        }

        if (json.extra) {
            json.extra.forEach(function(m) {
                if(m.text) {
                    msg += m.text
                }
            }, this)
        }

        msg = msg.replace(formattingCodesRegex, "");

        log(`[CHAT] ${msg}`);

        if (snitch.test(msg)) {
            let group;
            let hoverText = json.hoverEvent.value[0].text;

            if (hoverText)
                group = snitch_group.exec(hoverText)[1];

            handleSnitchMessage(msg, group)
        } else {
            handleChatMessage(msg)
        }
    });

    mcClient.on('success', packet => {
        log(`Logged in to ${config.mcHost}${config.mcPort===25565?'':':'+config.mcPort} with ${packet.username}`)
    });

    mcClient.on('end', () => {
        mcClient.removeAllListeners();
        setTimeout(start, 5000)
    })
}
start();

async function sendSnitchMessage(user, action, snitchName, worldName, x, y, z, group) {
    let message = "[" + dateFormat(new Date(), "isoTime") + "] ";

    message += "**" + user + "**";
    message += " " + action;
    message += " " + (snitchName == "" ? "unnamed" : snitchName);
    message += " (" + x + ", " + y + ", " + z + ")";

    if (group) {
        message += " *[" + group + "]*";

        let groupConfig = config.alertGroups[group];

        if (groupConfig) {
            for (let test of Object.keys(groupConfig)) {
                if (snitchName.includes(test))
                    message += " " + groupConfig[test];
            }
        }
    }

    log("[SNITCH] " + message);
    await discordChannel.send(message)
}

async function sendChatMessage(channel, username, message) {
    let name = username;

    if (channel != null)
        name = `[${channel}] ${name}`;

    const chatEmbed = new Discord.MessageEmbed()
        .setColor('#14836E')
        .setAuthor(name, "https://minotar.net/helm/" + username + ".png")
        .setDescription(message)
        .setTimestamp();
    
    if (channel != null)
        chatEmbed.setFooter(channel);
    else {
        chatEmbed.setFooter("Local Chat");
        channel = "local";
    }

    if (config.botChannel[channel] && config.botChannel[channel] !== "")
        discordClient.channels.cache.get(config.botChannel[channel]).send(chatEmbed);
    else
        //discordChannel.send(chatEmbed)
        console.log("[DISCARDED] " + channel + " " + username + ": " + message);
}

const snitch = /\s*\*\s*([A-Za-z_0-9]{2,16}) (entered snitch at|logged out in snitch at|logged in to snitch at) (\S*) \[(\w+) (-?\d+) (\d+) (-?\d+)](?: (-?[0-9]+)m ([NESW]+))?/;
const snitch_group = /Group: (\w+)/;

function handleSnitchMessage(msg, group) {
    const matches = snitch.exec(msg);

    let action = "hit";

    if (matches[2] == "logged out in")
        action = "logged out";

    if (matches[2] == "logged in to")
        action = "logged in";

    sendSnitchMessage(matches[1], action, matches[3], matches[4], matches[5], matches[6], matches[7], group)
}

const nl_msg = /^\[(.+)] (\w+): (.+)/;
function handleNameLayerMessage(msg) {
    const matches = nl_msg.exec(msg);
    sendChatMessage(matches[1], matches[2], matches[3])
}

const l_msg = /^<(\w+)> (.+)/;
function handleLocalMessage(msg) {
    const matches = l_msg.exec(msg);
    sendChatMessage(null, matches[1], matches[2])
}

function handleChatMessage(msg) {
    if (nl_msg.test(msg)) {
        handleNameLayerMessage(msg)
    } else if (l_msg.test(msg)) {
        handleLocalMessage(msg)
    }
}

function log(msg) {
    const time = dateFormat(new Date(), "isoTime");
    console.log(time + " " + msg);
}