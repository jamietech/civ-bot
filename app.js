const winston = require('winston');
require('winston-daily-rotate-file');
const config = require('./config/config');
const Discord = require('discord.js');
const mc = require('minecraft-protocol');
const discordClient = new Discord.Client();
const dateFormat = require('dateformat');

/*
    Setup logging
 */

const l_format = winston.format.printf((info) => {
    return `${dateFormat(new Date(), "isoTime")} ${info.level}\t${info.message}`;
});

const rotate = new (winston.transports.DailyRotateFile)({
    filename: '%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    dirname: 'logs',
    createSymlink: true,
    symlinkName: 'latest.log'
});

const l = winston.createLogger({
    level: 'info',
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), l_format)
        }),
        new winston.transports.File({ filename: 'logs/errors.log', level: 'warn' }),
        rotate
    ],
    format: l_format
});

/*
    Connect to Discord
 */

let fallbackChannelSnitch;

discordClient.on('ready', async () => {
    fallbackChannelSnitch = discordClient.channels.cache.get(config.snitchChannels.default);
    l.info(`Logged in to Discord as ${discordClient.user.tag}!`)
});

discordClient.login(config.botToken).catch(error => l.error('Encountered error while connecting to Discord: ', error));

/*
    Connect to Minecraft
 */

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

        if (json.text)
            msg += json.text;

        if (json.extra)
            json.extra.forEach(function(m) {
                if(m.text)
                    msg += m.text
            }, this);

        msg = msg.replace(formattingCodesRegex, "");

        l.info(`Chat recv: ${msg}`);

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
        l.info(`Minecraft successfully connected to ${config.mcHost}${config.mcPort === 25565 ? '' : ':' + config.mcPort} with ${packet.username}`);
        delay = delayDefault;
    });

    mcClient.on('end', () => {
        l.warn(`Disconnected from server! Retrying in ${delay/1000}s...`);
        mcClient.removeAllListeners();
        retry()
    });

    mcClient.on('disconnect', packet => {
       l.error(`Kicked from server while joining: ${packet.reason}`)
    });

    mcClient.on('kick_disconnect', packet => {
        l.error(`Kicked from server: ${packet.reason}`)
    });

    mcClient.on('error', error => {
        if (error.code == 'ECONNREFUSED') {
            l.error("Connection was refused!");
        } else {
            l.error('Encountered an error: ', error);
        }
    })
}
start();

/*
    Deal with reconnection attempts
 */

const delayDefault = 5000;
let delay = delayDefault;
let lastAttempt = 0;
function retry() {
    // Cool down
    let now = Date.now();
    if (lastAttempt >= now - delayDefault)
        return;
    lastAttempt = now;

    // Attempt reconnection
    setTimeout(start, delay);
    delay = delay * 5;
}

/*
    Handle messages received
 */

async function sendSnitchMessage(user, action, snitchName, worldName, x, y, z, group) {
    let message = "[" + dateFormat(new Date(), "UTC:HH:MM:ss") + "] ";

    message += "**" + user + "**";
    message += " " + action;
    message += " " + (snitchName == "" ? "unnamed" : snitchName);
    message += " (" + x + ", " + y + ", " + z + ")";

    let channels = [ config.snitchChannels.default ];

    if (group) {
        message += " *[" + group + "]*";

        let groupConfig = config.alertGroups[group];

        if (groupConfig) {
            for (let test of Object.keys(groupConfig)) {
                if (snitchName.includes(test))
                    message += " " + groupConfig[test];
            }
        }

        let groupChannels = config.snitchChannels[group];

        if (groupChannels) {
            if (groupChannels instanceof Array)
                channels = groupChannels;
            else
                channels = [ groupChannels ];
        }
    }

    message = message.replace(/_/g, "\\_");

    l.info(`Relayed above snitch message to ${channels.length} Discord channel(s)`);

    channels.forEach(channel_id => {
        let channel = discordClient.channels.cache.get(channel_id);

        try {
            channel.send(message)
        } catch (e) {
            l.error('Failed to send message to Discord: ', e)
        }
    });
}

async function sendChatMessage(group, username, message) {
    let name = username;

    let channels;

    if (group == null) {
        channels = [ config.chatChannels.local ];
    } else {
        let groupChannels = config.chatChannels[group];

        if (groupChannels) {
            if (groupChannels instanceof Array)
                channels = groupChannels;
            else
                channels = [ groupChannels ];
        } else {
            l.info(`Discarded this message: ${group} ${username}: ${message}`);
            return
        }

        name = `[${group}] ${name}`
    }

    const chatEmbed = new Discord.MessageEmbed()
        .setColor('#14836E')
        .setAuthor(name, "https://minotar.net/helm/" + username + ".png")
        .setDescription(message)
        .setTimestamp();

    if (group == null) {
        chatEmbed.setFooter("Local Chat")
    } else {
        chatEmbed.setFooter(group)
    }

    channels.forEach(channel_id => {
        let channel = discordClient.channels.cache.get(channel_id);

        if (channel) {
            try {
                channel.send(chatEmbed)
            } catch (e) {
                l.error('Failed to send message to Discord', e)
            }
        }
    });
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
