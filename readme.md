## civ-bot

A snitch message relay for Minecraft &rarr; Discord.

### Setup
1. Install [node.js](https://nodejs.org/)
2. Clone or download this repository
3. Run `npm install`
4. Copy `config/config.example.json` to `config/config.json`
5. Configure config using guide below

Then to start the bot any time run `npm start`

### Config

You can configure the bot with the following options in the `config.json` file:

* **botToken** (required): the [Discord bot token](https://discord.com/developers/applications/me)
* **mcUsername** (required): the email address of the Mojang account
* **mcPassword** (required): the password of the Mojang account
* **mcHost** (required): the IP address of the Minecraft server
* **mcPort** (required): the port of the Minecraft server (usually 25565)
* **mcVersion** (required): the Minecraft protocol version to use (e.g. `1.12.2`)

In the `chatChannels` array, you can add the names of NameLayer groups and direct their chat messages to certain channel(s). The name `local` is reserved for "global chat" which is heard within the server-configured distance of the bot (i.e. chat not sent to a NameLayer group).

In the `snitchChannels` array, you can add the names of NameLayer groups and direct their snitch messages to certain channel(s). The name `default` is reserved for messages that aren't configured to be directed anywhere else.

In the `alertGroups` array, you can configure Strings to be appended to the snitch message relayed to Discord if certain characters are in the name of the snitch. As a child of `alertGroups`, you should create an object with the name of the NameLayer group you want to target. As a child of that, you should make a String object with the key as the characters to be checked and the value as the String to be appended to the message.
 
For example, if your vault snitches contain the character "!" and you want everyone to be alerted when they are triggered, you would use the following configuration:

```json
{
  "alertGroups": {
    "MySnitches": {
      "!": "@everyone"
    }   
  }
}
```

### Using
- [discord.js](https://github.com/hydrabolt/discord.js) for connecting to Discord API
- [minecraft-protocol](https://github.com/PrismarineJS/node-minecraft-protocol) for connecting to Minecraft servers
- [minotar](https://minotar.net/) for the minecraft skin avatars
