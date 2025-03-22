const Eris = require('eris');
const client = new Eris(process.env.DISCORD_BOT_TOKEN); // Replace with your bot token (bro really thought i was gonna put a token here lmao thats crazy ngl)

const Store = require('electron-store');
const store = new Store();
const fetch = require('node-fetch');

module.exports = {
    client: client
};

var ping = 0;
var availableRegions = ["us-west",
                        "us-east",
                        "us-central",
                        "us-south",
                        "singapore",
                        "southafrica",
                        "sydney",
                        "europe",
                        "brazil",
                        "hongkong",
                        "russia",
                        "japan",
                        "india",
                        "dubai",
                        "amsterdam",
                        "london",
                        "frankfurt",
                        "eu-central",
                        "eu-west"
                    ];

client.on('ready', () => {
    console.log(`Logged in as ${client.user.username}#${client.user.discriminator}!`);
    console.log(`With ${Object.keys(client.users).length} users, in ${Object.keys(client.channels).length} channels of ${Object.keys(client.guilds).length} guilds.`);

    setInterval(() => {
        if(ping != client.ping){
            document.getElementById('pingSpan').innerText = `Ping: ${Math.round(client.ping)}`;
            ping = client.ping;
        }
    }, 5000);

    client.getVoiceRegions()
        .then(regions => {
            console.log(regions, regions.map(region => region.id));
            availableRegions = regions.map(region => region.id)
        })
        .catch(console.error);

    setClientUser(client.user);

    delGuilds();

    for (const guildId in client.guilds) {
        const guild = client.guilds[guildId];
        addGuild(guild);
        document.getElementById('gd/' + guild.id).addEventListener('click', selectGuild);
    }

    try {
        if(store.has('lastGuild'))
            document.getElementById(store.get('lastGuild')).click();
    } catch (error) {
        // console.log(error);
        if(document.getElementsByClassName('listItem')[2]) document.getElementsByClassName('listItem')[2].click();
    }

    try {
        if(store.has('lastChannel'))
            document.getElementById(store.get('lastChannel')).click();
    } catch (error) {
        // console.log(error);
        if(document.getElementsByClassName('sidebarChannelContainer')[0]) document.getElementsByClassName('sidebarChannelContainer')[0].click();
    }

    goToApp();
});

client.on('messageCreate', msg => {
    // if (msg.content === 'ping') {
    //     msg.channel.createMessage('pong');
    // }
    // console.log(msg);

    let channelId = msg.channel.id,
        channel = document.getElementById(`chc/${channelId}`);

    if(store.get('lastGuild') !== `gd/${msg.guildID}`) document.getElementById(`gd/${msg.guildID}`).classList.add('newMessage');

    if(channel && store.get('lastChannel') === `chc/${channelId}`){
        updateChat([{date: timestampToObject(msg.timestamp), message: msg}], {getMimeType: getMimeType, send:sendMessage, deleteMessage: deleteMessage, react: reactMessage, channel: msg.channel});

        let imgsForResolving = document.getElementsByClassName('needEmojiResolving');
        for(emoji of imgsForResolving){
            emoji.classList.remove('needEmojiResolving');
            if(client.emojis[emoji.getAttribute('data-id')]){
                emoji.src = client.emojis[emoji.getAttribute('data-id')].url;
            }
            else{
                emoji.src = `https://cdn.discordapp.com/emoji/${emoji.getAttribute('data-id')}.png`;
            }
        }
    }

});

client.on('messageUpdate', (msg, oldMsg) => {
    // console.log(msg);

    let channelId = msg.channel.id,
        channel = document.getElementById(`chc/${channelId}`);

    if(channel && store.get('lastChannel') === `chc/${channelId}`) updateChat([{date: timestampToObject(msg.timestamp), message: msg}], {edited: true, getMimeType: getMimeType, send:sendMessage, deleteMessage: deleteMessage, react: reactMessage, channel: msg.channel});
});

client.on('messageDelete', msg => {
    // console.log(msg);

    let message = document.getElementById(`msg/${msg.id}`),
        deleteSeparator = false;

    if(message){

        if(message.nextSibling){
            if(!message.nextSibling.classList.contains('messageWrapper')){
                deleteSeparator = true;
            }else{
                deleteSeparator = false;
            }
        }else if(message.previousSibling){
            if(message.previousSibling.classList.contains('messageSeparator')){
                deleteSeparator = true;
            }else{
                deleteSeparator = false;
            }
        }


        if(deleteSeparator)
            message.previousSibling.remove();
        message.remove();
    }
});

client.on("error", (err) => {
    console.error(err);
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
    // console.log(newPresence);
    const guildId = store.get('lastGuild')?.substring(3);
    if (guildId && newPresence.guild_id === guildId) { // newPresence.status !== oldPresence.status &&
        const guild = client.guilds[newPresence.guild_id];
        const channelId = store.get('lastChannel')?.split('/')[1];
        if (guild && channelId) {
            const channel = guild.channels[channelId];
            if (channel) {
                const member = guild.members[newPresence.user.id];
                if (member) {
                    loadMembers(guild, channel);
                }
            }
        }
    }
});

client.on('messageReactionAdd', async (msg, emoji, userId) => {
    // console.log(msg, emoji, userId);
    // console.log(`reaction added`);

    let channelId = msg.channel.id,
        channel = document.getElementById(`chc/${channelId}`);

    if(channel && store.get('lastChannel') === `chc/${channelId}`){
        const fullMessage = await client.getMessage(msg.channel.id, msg.id);
        updateChat([{date: timestampToObject(fullMessage.timestamp), message: fullMessage}], {edited: true, getMimeType: getMimeType, send:sendMessage, deleteMessage: deleteMessage, react: reactMessage, channel: fullMessage.channel});
    }

});

client.on('messageReactionRemove', async (msg, emoji, userId) => { // messageReactionRemove
    // console.log(msg, emoji, userId);
    // console.log(`reaction removed`);

    let channelId = msg.channel.id,
        channel = document.getElementById(`chc/${channelId}`);

    if(channel && store.get('lastChannel') === `chc/${channelId}`){
        const fullMessage = await client.getMessage(msg.channel.id, msg.id);
        updateChat([{date: timestampToObject(fullMessage.timestamp), message: fullMessage}], {edited: true, getMimeType: getMimeType, send:sendMessage, deleteMessage: deleteMessage, react: reactMessage, channel: fullMessage.channel});
    }

});

function reactMessage(e){
    let target = e.target,
        guildId = '',
        channelId = '',
        messageId = '',
        emojiName = ''
        me = false;

    if(target.classList.contains('messageReactionCustomEmoji'))
        target = target.parentNode;

    if(target.classList.contains('messageReactionSelf'))
        me = true;

    guildId = target.getAttribute('guild');
    channelId = target.getAttribute('channel');
    messageId = target.getAttribute('message');
    emojiName = target.getAttribute('name');
    const emojiId = target.getAttribute('emojiid');

    // console.log(guildId, channelId, messageId, emojiName, emojiId);

    const guild = client.guilds[guildId];
    if (!guild) return;
    const channel = guild.channels[channelId];
    if (!channel || channel.type !== 0) return;

    if(me){
        channel.getMessage(messageId).then(msg => {
            const reaction = msg.reactions[emojiName || emojiId];
            if (reaction) {
                client.removeMessageReaction(channelId, messageId, emojiName || emojiId, client.user.id).catch(console.error);
            }
        }).catch(console.error);

    }else{
        client.addMessageReaction(channelId, messageId, emojiName || emojiId).catch(console.error);
    }
}

function selectGuild(e){
    let guildIdElement = e.target;
    if(guildIdElement.classList.contains('guildAcronym'))
        guildIdElement = guildIdElement.parentNode;
    if(guildIdElement.classList.contains('guildImage'))
        guildIdElement = guildIdElement.parentNode;
    if(guildIdElement.classList.contains('wrapper'))
        guildIdElement = guildIdElement.parentNode;
    if(guildIdElement.classList.contains('listItem'))
        guildIdElement = guildIdElement.id;

    const guildId = guildIdElement.substring(3);
    const guild = client.guilds[guildId];
    if (!guild) return;

    let firstTextChannel;

    document.getElementById(guildIdElement).classList.remove('newMessage');

    if(document.getElementById(guildIdElement).classList.contains('guildSelected'))
        return;

    for( el of document.getElementsByClassName('listItem') ){
        el.classList.remove('guildSelected');
    }

    delChannels();
    document.getElementsByClassName('sidebarGuildName')[0].innerText = guild.name;
    document.getElementsByClassName('sidebarGuildName')[0].id = `gdo/${guild.id}`;
    document.getElementsByClassName('sidebarGuildName')[0].setAttribute('guild', guild.id);
    document.getElementsByClassName('sidebarContainer1')[0].addEventListener('click', getGuildOptions);


    const descPos = (a, b) => {
        if (a.type !== b.type) {
            if (a.type === 2) return 1; // Voice channel type is 2 in Eris
            else return -1;
        } else return a.position - b.position;
    };

    const channels = new Map();

    channels.set('__none', Object.values(guild.channels).filter(channel => !channel.parentID && channel.type !== 4).sort(descPos)); // Category type is 4 in Eris

    const categories = Object.values(guild.channels).filter(channel => channel.type === 4).sort(descPos);
    categories.forEach(category => {
        const children = Object.values(guild.channels).filter(c => c.parentID === category.id).sort(descPos);
        channels.set(category.id, children);
    });

    for (let [categoryID, children] of channels) {
        const category = guild.channels[categoryID];
        if (category) addChannel(category);
        for (let child of children){
            if(!firstTextChannel && child.type === 0) firstTextChannel = child.id; // Text channel type is 0 in Eris
            addChannel(child, selectChannel, selectChannelForChat, voiceUserDrop);
            if(child.type == 2 && Object.keys(child.voiceMembers).length > 0){ // Voice channel type is 2 in Eris
                for(const memberId in child.voiceMembers){
                    const member = child.voiceMembers[memberId];
                    addVoiceUser(child, member.member);
                    if(member.mute || member.self_mute)
                        setMute(member.member, true);
                    if(guild.afk_channel_id === member.channel_id)
                        setMute(member.member, true);
                    if(member.deaf || member.self_deaf)
                        setDeaf(member.member, true);
                    if(member.self_stream)
                        setGoLive(member.member, true);
                }
            }
        }
    }

    for (const channelId in guild.channels) {
        const channel = guild.channels[channelId];
        if(channel.type === 4) // Category type is 4 in Eris
            document.getElementById('ch/' + channel.id).addEventListener('click', selectChannel);
    }

    loadMembers(guild);

    if(firstTextChannel && e.isTrusted){
        document.getElementById(`chc/${firstTextChannel}`).click();
    }

    document.getElementById(guildIdElement).classList.add('guildSelected');
    store.set('lastGuild', guildIdElement);
}

function voiceUserDrop(el){
    el.preventDefault();
    let userId = el.dataTransfer.getData("text");

    let target = el.target,
        channelId = '';
    while(!target.classList.contains('sidebarChannelContainer')){
        target = target.parentNode;
    }
    target.classList.remove('sidebarChannelContainerOnDrag');
    channelId = target.id;

    const guild = client.guilds[channelId.substring(3)];
    if (guild) {
        guild.moveMember(userId.substr(4), channelId.substr(3)).catch(console.error);
    }
}

async function getGuildOptions(e){
    let target = e.target;
    while(!target.classList.contains('sidebarGuildName')){
        target = target.children[0];
    }


    let gdId = target.getAttribute('guild'),
        guild = client.guilds[gdId];
    if (!guild) return;

    let types = [   'string',
                    'number',
                    'boolean',
                    // 'bigint', // bigint is not directly comparable with typeof in this context
                    // 'undefined',
                    'object',
    ];
    let whitelist = [
                        {name : 'name', method : "edit", inputOptions : { name: true }},
                        {name : 'id', method : ""},
                        {name : 'afk_channel_id', method : ""},
                        {name : 'member_count', method : ""},
                        {name : 'createdAt', method : ""},
                        {name : 'joinedAt', method : ""},
                        {name : 'region', method : "edit", inputOptions : { region: true }, options: availableRegions},
    ];

    whitelist.has = function(string){
        for(var i = 0 ; i < this.length; i++){
            if(this[i].name === string){
                return true;
            }
        }
        return false;
    };

    async function saveOption(e){
        if(e.target.innerText !== 'Save')
            return;
        let target = e.target,
            parent = target.parentNode,
            gdId = parent.getAttribute('channel'),
            method = parent.getAttribute('method'),
            optionName = parent.getAttribute('optionName'),
            value =parent.children[1].value,
            originalValue = parent.getAttribute('originalValue');

        parent.children[1].classList.remove('error');
        clearTaskBar();

        if(value == originalValue)
            return;

        const guildToEdit = client.guilds[gdId];
        if (!guildToEdit || !guildToEdit[method]) return;

        const payload = {};
        payload[optionName] = value;

        guildToEdit[method](payload).catch(function(err){
            parent.children[1].classList.add('error');
            error(err.message.replace(/\n/g, ", "));
            console.error(err);
        }).then(function(e){
            log(`Set ${parent.children[0].innerText} of ${gdId} from ${originalValue} to ${value}`);
            document.getElementById(`gd/${gdId}`).click();
            document.getElementById(`gdo/${gdId}`).click();
        });
    }

    clearChat();
    document.getElementsByClassName('chatTitleName')[0].innerText = guild.name;
    let options =;

    for(let data of whitelist){
        if(typeof(guild[data.name]) == 'undefined')
            continue;
            let opt = { type: 'input', channel: guild, data: data.name, method: data.method, inputOptions: data.inputOptions, options: data.options };
            if(data.method !== '') opt.callback = saveOption;
            options.push(opt);
    }

    options.push({type: 'separator'});

    for(let data in guild){
        if( types.includes( typeof(guild[data]) ) ){
            if(!whitelist.has(data))
                options.push({ type: 'input', channel: guild, data: data, method: '' });
        }
    }

    addChatOp(options);
    store.set('lastChannel', `gdo/${guild.id}`);
}

function loadMembers(guild, channel){

    function nameSorter(a, b){
        let aName = a.nick != null ? a.nick : a.user.username,
            bName = b.nick != null ? b.nick : b.user.username;
        if(aName < bName) return -1;
        if(aName > bName) return 1
        return 0;
    }

    function hasPermissions(member){
        if(channel){
            if(!channel.permissionsOf(member.id).has('viewChannel'))
                return false;
        }
        return true;
    }

    delMembers();

    const roles = Object.values(guild.roles).sort((a, b) => b.position - a.position);
    for (const role of roles) {
        if(role.hoist || role.name == '@everyone'){
            const members = Object.values(guild.members).filter(member => member.roles.includes(role.id)).sort(nameSorter).filter(hasPermissions).filter(member => member.status !== 'offline');
            for (const member of members) {
                if(!document.getElementById(`mb/${member.id}`)){
                    addMemeber(member, channel);
                    document.getElementById(`mb/${member.id}`).addEventListener('click', selectMember);
                }
            }
        }
    }

    const offlineMembers = Object.values(guild.members).sort(nameSorter).filter(hasPermissions).filter(member => member.status === 'offline');
    for (const member of offlineMembers) {
        addMemeber(member, channel);
        document.getElementById(`mb/${member.id}`).addEventListener('click', selectMember);
    }
}

async function selectChannelForChat(e){
    let channelIdElement = e.target;

    if(!channelIdElement.classList.contains('sidebarChannelNameOption'))
        while(channelIdElement.parentNode){
            if( channelIdElement.classList.contains('sidebarChannelContainer') )
                break;
            channelIdElement = channelIdElement.parentNode;
        }

    const channelId = channelIdElement.id;

    if(channelId[2] === 'c'){

        const channel = client.getChannel(channelId.substring(4));
        if (!channel || channel.type !== 0) return;

        clearChat();
        document.getElementsByClassName('chatTitleName')[0].innerText = channel.name;
        createChat(sendMessage, channel);
        channel.getMessages({ limit: 50 })
            .then(messages => {
                clearChat();

                function sorting(a,b){
                    return a.id - b.id;
                }

                const sortedMessages = Object.values(messages).sort(sorting);
                let obj =;

                for (const message of sortedMessages) {
                    var time = timestampToObject(message.timestamp);
                    obj.push({date: time, message: message});
                }

                updateChat(obj, {getMimeType: getMimeType, send:sendMessage, deleteMessage: deleteMessage, react: reactMessage, channel: channel});

                let imgsForResolving = document.getElementsByClassName('needEmojiResolving');
                for(emoji of imgsForResolving){
                    emoji.classList.remove('needEmojiResolving');
                    if(client.emojis[emoji.getAttribute('data-id')]){
                        emoji.src = client.emojis[emoji.getAttribute('data-id')].url;
                    }
                    else{
                        emoji.src = `https://cdn.discordapp.com/emoji/${emoji.getAttribute('data-id')}.png`;
                    }
                }
            })
            .catch(console.error);

        loadMembers(channel.guild, channel);


        store.set('lastChannel', channelId);
    }
}

function sendMessage(channelId, content){
    return client.createMessage(channelId, content);
}

function deleteMessage(e){
    let target = e.target;
    client.deleteMessage(target.getAttribute('guildId'), target.getAttribute('channelId'), target.getAttribute('messageId')).catch(console.error);
}

async function getMimeType(url){
    try {
        const response = await fetch(url);
        return response;
    } catch (error) {
        console.error("Error fetching:", error);
        throw error;
    }
}


async function selectChannel(e){
    let channelIdElement = e.target;
    let types = [   'string',
                    'number',
                    'boolean',
                    // 'bigint',
                    // 'undefined',
                    'object',
    ];
    let whitelist = [   {name : 'guild', method : ""},
                        {name : 'name', method : "edit", inputOptions: { name: true } },
                        {name : 'id', method : ""},
                        {name : 'type', method : ""},
                        {name : 'topic', method : "edit", inputOptions: { topic: true } },
                        {name : 'bitrate', method : "edit", inputOptions: { bitrate: true } },
                        {name : 'joinable', method : ""},
                        {name : 'user_limit', method : "edit", inputOptions: { user_limit: true } },
                        {name : 'full', method : ""},
                        {name : 'createdAt', method : ""},
                        {name : 'nsfw', method : "edit", inputOptions: { nsfw: true } },
                        {name : 'rate_limit_per_user', method : "edit", inputOptions: { rate_limit_per_user: true } },
                        {name : 'position', method : ""},
                        {name : 'calculatedPosition', method : ""},
                        {name : 'typing', method : ""},
                        {name : 'typingCount', method : ""},
    ];

    whitelist.has = function(string){
        for(var i = 0 ; i < this.length; i++){
            if(this[i].name === string){
                return true;
            }
        }
        return false;
    };

    while(channelIdElement.parentNode){
        if( channelIdElement.classList.contains('voiceUser') ){
            selectVoiceMember(channelIdElement.id.substring(1));
            return;
        }
        if( channelIdElement.classList.contains('sidebarChannelNameOption') || channelIdElement.classList.contains('sidebarChannelContainer') || channelIdElement.classList.contains('sidebarCategoryContainer') )
            break;
        channelIdElement = channelIdElement.parentNode;
    }
    if(channelIdElement)
        channelIdElement = channelIdElement.id;

    if(channelIdElement[2] === 'c')
        return;

    const channel = client.getChannel(channelIdElement.substring(3));
    if (!channel) return;

    clearChat();
    document.getElementsByClassName('chatTitleName')[0].innerText = channel.name;

    async function saveOption(e){
        if(e.target.innerText !== 'Save')
            return;
        let target = e.target,
            parent = target.parentNode,
            chId = parent.getAttribute('channel'),
            method = parent.getAttribute('method'),
            optionName = parent.getAttribute('optionName'),
            value = parent.children[1].value,
            originalValue = parent.getAttribute('originalValue');

        parent.children[1].classList.remove('error');
        clearTaskBar();

        if(value == originalValue)
            return;

        const channelToEdit = client.getChannel(chId);
        if (!channelToEdit || !channelToEdit[method]) return;

        const payload = {};
        payload[optionName] = value;

        channelToEdit[method](payload).catch(function(err){
            parent.children[1].classList.add('error');
            error(err.message.replace(/\n/g, ", "));
            console.error(err);
        }).then(function(e){
            log(`Set ${parent.children[0].innerText} of ${chId} from ${originalValue} to ${value}`);
            const guildId = client.getChannel(chId)?.guildID;
            if (guildId) {
                document.getElementById(`gd/${guildId}`).click();
                document.getElementById(`ch/${chId}`).click();
            }
        });
    }

    let options =;

    for(let data of whitelist){
        if(typeof(channel[data.name]) == 'undefined')
            continue;
            let opt = { type: 'input', channel: channel, data: data.name, method: data.method, inputOptions: data.inputOptions };
            if(data.method !== '') opt.callback = saveOption;
            options.push(opt);
    }

    options.push({type: 'separator'});

    for(let data in channel){
        if( types.includes( typeof(channel[data]) ) ){
            if(!whitelist.has(data))
                options.push({ type: 'input', channel: channel, data: data, method: '' });
        }
    }

    addChatOp(options);

    loadMembers(channel.guild, channel);

    store.set('lastChannel', channelIdElement);
}

function selectVoiceMember(id){
    document.getElementById(id).click();
}

client.on('voiceChannelJoin', (member, newChannel) => {
    if(newChannel){
        addVoiceUser(newChannel, member);
    }
});

client.on('voiceChannelLeave', (member, oldChannel) => {
    if(oldChannel){
        delVoiceUser(member);
    }
});

client.on('voiceChannelSwitch', (member, newChannel, oldChannel) => {
    if(oldChannel){
        delVoiceUser(member);
    }
    if(newChannel){
        addVoiceUser(newChannel, member);
    }
});

client.on('voiceStateUpdate', (member, oldState, newState) => {
    if (newState.channelID === null) {
        delVoiceUser(member);
    } else {
        const channel = client.getChannel(newState.channelID);
        if (channel) {
            addVoiceUser(channel, member);
        }
    }

    if(newState.mute || newState.selfMute)
        setMute(member, true);
    else if (oldState.mute || oldState.selfMute)
        setMute(member, false);

    const guild = member.guild;
    if (guild && guild.afk_channel_id === newState.channelID)
        setMute(member, true);
    else if (guild && guild.afk_channel_id === oldState.channelID)
        setMute(member, false);

    if(newState.deaf || newState.selfDeaf)
        setDeaf(member, true);
    else if (oldState.deaf || oldState.selfDeaf)
        setDeaf(member, false);

    if(newState.selfStream)
        setGoLive(member, true);
    else if (oldState.selfStream)
        setGoLive(member, false);
});

async function selectMember(e){
    let memberDiv = e.target;
    let types = [   'string',
                    'number',
                    'boolean',
                    // 'bigint',
                    // 'undefined',
                    'object',
    ];
    let whitelist = [   {name : 'guild', method : ""},
                        {name : 'nick', method : "edit", inputOptions: { nick: true } },
                        {name : 'displayName', method : ""},
                        {name : 'id', method : ""},
                        {name : 'deaf', method : "edit", inputOptions: { deaf: true } },
                        {name : 'mute', method : "edit", inputOptions: { mute: true } },
                        {name : 'voiceState', method : "edit", inputOptions: { channelID: true } },
                        {name : 'joinedAt', method : ""},
    ];

    whitelist.has = function(string){
        for(var i = 0 ; i < this.length; i++){
            if(this[i].name === string){
                return true;
            }
        }
        return false;
    };

    while(memberDiv.parentNode){
        if( memberDiv.classList.contains('member') ) break;
        memberDiv = memberDiv.parentNode;
    }
    const guildId = memberDiv.getAttribute('guild');
    const memberId = memberDiv.id.substring(3);
    const guild = client.guilds[guildId];
    const member = guild ? guild.members[memberId] : null;

    if (!member) return;

    clearChat();
    document.getElementsByClassName('chatTitleName')[0].innerText = member.nick != null ? member.nick : member.user.username;

    async function saveOption(e){
        if(e.target.innerText === 'Copy')
            return;
        let target = e.target,
            opBtn = target.hasAttribute("opBtn"),
            parent = opBtn ? target : target.parentNode,
            gdId = parent.getAttribute('guild'),
            mbId = parent.getAttribute('channel'),
            method = parent.getAttribute('method'),
            optionName = parent.getAttribute('optionName'),
            value = opBtn ? parent.getAttribute('originalValue') : parent.children[1].value,
            originalValue = parent.getAttribute('originalValue');

        if(opBtn){
            value = (value == 'true');
            value = !value;
        }
        if(!opBtn) parent.children[1].classList.remove('error');
        clearTaskBar();

        const guildToEdit = client.guilds[gdId];
        const memberToEdit = guildToEdit ? guildToEdit.members[mbId] : null;

        if (!memberToEdit || !memberToEdit[method]) return;

        const payload = {};
        if (optionName === 'channelID') {
            payload.channelID = value === 'null' ? null : value;
        } else {
            payload[optionName] = value;
        }

        memberToEdit[method](payload).catch(function(err){
            if(!opBtn) parent.children[1].classList.add('error');
            error(err.message.replace(/\n/g, ", "));
            console.error(err);
        }).then(function(e){
            if(opBtn){
                log(`${parent.innerText}${parent.innerText=='Mute'||parent.innerText=='Unute'?'d':''}${parent.innerText=='Deaf'||parent.innerText=='Undeaf'?'ened':''}${parent.innerText=='Disconnect'?'ed':''} ${mbId}`);
            }else
                log(`Set ${parent.children[0].innerText} of ${mbId} from ${originalValue} to ${value}`);
                document.getElementById(`gd/${gdId}`).click();
                document.getElementById(`mb/${mbId}`).click();
        });
    }

    async function sendToVoid(e){
        let target = e.target,
            gdId = target.getAttribute('guild'),
            mbId = target.getAttribute('channel');

        const guildToSend = client.guilds[gdId];
        const memberToSend = guildToSend ? guildToSend.members[mbId] : null;
        const afkChannelId = guildToSend ? guildToSend.afk_channel_id : null;

        if (memberToSend) {
            memberToSend.edit({ channelID: target.innerText === 'Disconnect' ? null : afkChannelId }).catch(console.error);
        }
    }

    let options =;

    if(member.voiceState && member.voiceState.channelID){
        let afkString = `Send to ${guild.afkChannel ? guild.afkChannel.name : 'afk'} channel`;
        if(guild.afkChannel)
            afkString = `Send to ${guild.afkChannel.name} channel`;
        else
            afkString = `There is no afk channel ¯\\_(ツ)_/¯`;

        let opt = { type: 'btngroup', member: member,
                    btns:[  { type: 'toggle', name: 'Mute', method:'edit', optionName: 'mute', state: member.mute, callback: saveOption },
                            { type: 'toggle', name: 'Deaf', method:'edit', optionName: 'deaf', state: member.deaf, callback: saveOption },
                            { type: 'btn', name: afkString, method:'', disabled: (!guild.afkChannel ? true : undefined), callback: sendToVoid },
                            { type: 'btn', name: `Disconnect`, method:'', callback: sendToVoid }]};

        options.push(opt);

        options.push({type: 'separator'});
    }

    for(let data of whitelist){
        if(typeof(member[data.name]) == 'undefined')
            continue;
            let opt = { type: 'input', channel: member, data: data.name, method: data.method, optionName: Object.keys(data.inputOptions)[0] };
            if(data.method !== '') opt.callback = saveOption;
            options.push(opt);
    }

    options.push({type: 'separator'});

    for(let data in member){
        if( types.includes( typeof(member[data]) ) ){
            if(!whitelist.has(data))
                options.push({ type: 'input', channel: member, data: data });
        }
    }


    addChatOp(options);

    store.set('lastChannel', memberDiv.id);
}

client.connect();
