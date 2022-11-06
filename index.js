const dotenv = require("dotenv");
const { Player, QueryType } = require("discord-player");
const {SlashCommandBuilder, Routes, GatewayIntentBits, Client} = require("discord.js");
const {EmbedBuilder} = require("discord.js")
const {REST} = require("@discordjs/rest")


dotenv.config();
const TOKEN = process.env.TOKEN;

const CLIENT_ID = "1023352920781099028";
const GUILD_ID = "338112348994666507";

//Init client
const client = new Client({
    intents:[
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

//Init player
client.player = new Player(client, {
    ytdlOptions:{
        quality: "highestaudio",
        highWaterMark: 1 << 25
    }
});

//Command array
const commands = [
    //play command
    new SlashCommandBuilder()
        .setName("play")
        .setDescription("loads songs from music streaming services")
        .addSubcommand((subcommand)=>
            subcommand
                .setName("song")
                .setDescription("loads one song from music streaming services using a url")
                .addStringOption((option) => 
                            option
                                .setName("url")
                                .setDescription("the song's url")
                                .setRequired(true)))
        .addSubcommand((subcommand)=>
            subcommand
                .setName("playlist")
                .setDescription("loads a playlist from music streaming services using a url")
                .addStringOption((option) => 
                            option
                                .setName("url")
                                .setDescription("the playlist's url")
                                .setRequired(true)))
        .addSubcommand((subcommand)=>
            subcommand
                .setName("search")
                .setDescription("loads one song from music streaming services using a search keywords")
                .addStringOption((option) => 
                            option
                                .setName("keywords")
                                .setDescription("the search keywords")
                                .setRequired(true))),
    //info command
    new SlashCommandBuilder()
        .setName("info")
        .setDescription("Displays current song's info"),
    //pause command
    new SlashCommandBuilder()
        .setName("pause")
        .setDescription("Freely hault the progress of your chants"),
    //queue command
    new SlashCommandBuilder()
        .setName("queue")
        .setDescription("displays your queue")
        .addNumberOption((option) => option.setName("page").setDescription("Page number of the queue").setMinValue(1)),
    //quit command
    new SlashCommandBuilder()
        .setName("quit")
        .setDescription("Kick the bot out of the channel and clear the queue"),
    //resume command
    new SlashCommandBuilder()
        .setName("resume")
        .setDescription("Free your chants from their shackles"),
    //shuffle command
    new SlashCommandBuilder()
        .setName("shuffle")
        .setDescription("Communism will shuffle thine chants"),
    //skip command
    new SlashCommandBuilder()
        .setName("skip")
        .setDescription("hops to the following chant"),
    //delete command
    new SlashCommandBuilder()
        .setName("delete")
        .setDescription("makes the chosen chant scarce")
        .addNumberOption((option) => option.setName("song").setDescription("Chant number in the queue").setMinValue(1))

].map(command =>command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
	.then((data) => console.log(`Successfully registered ${data.length} application commands.`))
	.catch(console.error);


client.once('ready', ()=> {
    console.log('Ready!');
});

client.on("interactionCreate", async interaction=>{
    if(!interaction.isChatInputCommand()) return;

    const {commandName} = interaction;

    if(commandName === 'info')
    {
        const queue = client.player.getQueue(interaction.guildId);
        if (!queue) return await interaction.reply("such empty");

        let bar = queue.createProgressBar({
            queue: false,
            length: 19,

        });
        const song = queue.current;
        let embed = new EmbedBuilder()
        embed
        .setDescription(`Currently Chanting [${song.title}](${song.url})\n\n` + bar)
        .setThumbnail(song.thumbnail);

        await interaction.reply({
            embeds:[embed]
        });
    }
    else if(commandName === 'pause')
    {
        const queue = client.player.getQueue(interaction.guildId);
        if (!queue) return await interaction.reply("such empty");

        queue.setPaused(true);
        await interaction.reply("The chant's progress has been haulted");
    }
    else if(commandName === 'play')
    {
        if (!interaction.member.voice.channel) return interaction.reply("Get your ass into a voice channel!!")

        const queue = await client.player.createQueue(interaction.guild, {
		metadata: interaction.channel,
		autoSelfDeaf: false
	})
        if(!queue.connection) await queue.connect(interaction.member.voice.channel)

        let embed = new EmbedBuilder()

        if(interaction.options.getSubcommand() === "song"){
            let url = interaction.options.getString("url")
            const result = await client.player.search(url, {
                requestedBy: interaction.user,
                searchEngine: QueryType.YOUTUBE_VIDEO
            })
            if (result.tracks.length === 0) return interaction.reply("such empty")
            const song = result.tracks[0]
            await queue.addTrack(song)
            embed
                .setDescription(`**[${song.title}][${song.url}]**has been added to the Queue`)
                .setThumbnail(song.thumbnail)
                .setFooter({ text: `Duration: ${song.duration}`})
        }
        else if(interaction.options.getSubcommand() === "playlist"){
            let url = interaction.options.getString("url")
            const result = await client.player.search(url, {
                requestedBy: interaction.user,
                searchEngine: QueryType.YOUTUBE_PLAYLIST
            })
            if(result.tracks.length === 0) return interaction.reply("such empty")
            const playlist = result.playlist
            await queue.addTracks(result.tracks)
            embed
                .setDescription(`**${result.tracks.length} songs from [${playlist.title}][${playlist.url}]**have been added to the Queue`)
                .setThumbnail(result.tracks[0].thumbnail)
        }
        else if(interaction.options.getSubcommand() === "search"){
            let url = interaction.options.getString("keywords")
            const result = await client.player.search(url, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO
            })
            if (result.tracks.length === 0) return interaction.reply("such empty")
            const song = result.tracks[0]
            await queue.addTrack(song)
            embed
                .setDescription(`**[${song.title}][${song.url}]**has been added to the Queue`)
                .setThumbnail(song.thumbnail)
                .setFooter({ text: `Duration: ${song.duration}`})
        }
        if (!queue.playing) await queue.play()
        await interaction.reply({
            embeds: [embed]
        })
    }
	//delete update
    else if(commandName === 'delete')
    {
	 const queue = client.player.getQueue(interaction.guildId)
	 if(!queue || !queue.playing)
        {
            return await interaction.reply("such empty")
        }
	const songNumber = (interaction.options.getNumber("song") || queue.tracks.length)-1
	if(songNumber >= queue.tracks.length) return await interaction.reply(`Too high bozo`)
	const currentSong = queue.tracks[songNumber]
	queue.tracks.splice(songNumber, 1)
	await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`${currentSong.title} has been deleted from queue. `)
                    .setThumbnail(currentSong.thumbnail)
            ]
        })
	
    }
	//end delete update
    else if(commandName === 'queue')
    {
        const queue = client.player.getQueue(interaction.guildId)
        if(!queue || !queue.playing)
        {
            return await interaction.reply("such empty")
        }
        const TotalPages = Math.ceil(queue.tracks.length / 10) || 1
        const page = (interaction.options.getNumber("page") || 1)-1

        if(page > TotalPages)
        {
            return await interaction.reply(`Too high bozo`)
        }
        const queueString = queue.tracks.slice(page*10, page*10+10).map((song, i) => {
            return `**${page*10 +i+1}.** \`[${song.duration}]\` ${song.title} --<@${song.requestedBy.id}>`
        }).join("\n");

        const currentSong = queue.current

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`**Currently Playing**\n` +
                                   (currentSong ? `\`[${currentSong.duration}]\` ${currentSong.title} --<@${currentSong.requestedBy.id}>` : "such empty")+
                                    `\n\n**Queue**\n${queueString}`
                                    )
                    .setFooter({
                        text: `Page ${page + 1} of ${TotalPages}` 
                    })
                    .setThumbnail(currentSong.thumbnail)

            ]
        })
    }
    else if(commandName === 'quit')
    {
        const queue = client.player.getQueue(interaction.guildId)
        if (!queue) return await interaction.reply("such empty")
        queue.destroy()
        await interaction.reply("yeet")
    }
    else if(commandName === 'resume')
    {
        const queue = client.player.getQueue(interaction.guildId)
        if (!queue) return await interaction.reply("such empty")

        queue.setPaused(false)
        await interaction.reply("The chant's progress has been resumed")
    }
    else if(commandName === 'shuffle')
    {
        const queue = client.player.getQueue(interaction.guildId)
        if (!queue) return await interaction.reply("such empty")

        queue.shuffle()
        await interaction.reply("Communism has taken effect")
    }
    else if(commandName === 'skip')
    {
        const queue = client.player.getQueue(interaction.guildId)
        if (!queue) return await interaction.reply("such empty")

        const currentSong = queue.current

        queue.skip()
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`${currentSong.title} has been skipped. `)
                    .setThumbnail(currentSong.thumbnail)
            ]
        })
    }
})

client.login(TOKEN);



