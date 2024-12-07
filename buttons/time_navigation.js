const { EmbedBuilder, ActionRowBuilder } = require('discord.js');

/**
 * Handles button interactions for world time navigation and pagination.
 * @module time_navigation
 */
module.exports = {
    customId: ['time_previous', 'time_next'], // Support multiple customIds for the previous and next page buttons

    /**
     * Executes when the user presses the previous or next page button.
     * @param {import('discord.js').Interaction} interaction - The interaction event from the user
     * @param {import('discord.js').Client} client - The Discord client instance
     * @returns {Promise<void>}
     */
    async execute(interaction, client) {
        // Get the page number from the button's customId, assuming customId is 'time_previous_1' or 'time_next_2'
        const pageNumber = interaction.customId.split('_')[1]; // Extract the dynamic part (page number)
        const ITEMS_PER_PAGE = 25; // Number of timezones per page
        const timezones = require('moment-timezone').tz.names(); // Get all timezone names
        const totalPages = Math.ceil(timezones.length / ITEMS_PER_PAGE); // Calculate total number of pages
        
        await interaction.deferUpdate(); // Defer the interaction update to prevent button spam

        // Adjust the current page number based on the button pressed
        let currentPage = parseInt(interaction.customId.split('_')[2]);
        if (interaction.customId.startsWith('time_previous') && currentPage > 0) {
            currentPage--; // Decrease page number for previous button
        } else if (interaction.customId.startsWith('time_next') && currentPage < totalPages - 1) {
            currentPage++; // Increase page number for next button
        }

        // Create the embed message with the updated page number
        const embed = new EmbedBuilder()
            .setTitle('World Time')
            .setDescription(`This is page ${currentPage + 1} of ${totalPages}:`) // Show current page and total pages
            .setColor(global.getRandomColor()); // Set a random color for the embed

        // Display the timezones for the current page
        embed.addFields(
            timezones
                .slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE) // Slice the timezones based on the current page
                .map(tz => {
                    const time = require('moment-timezone').tz(tz); // Get the time for each timezone
                    return {
                        name: `${tz}`, // Display the timezone name
                        value: `${getClockEmoji(time)} ${time.format('YYYY-MM-DD HH:mm:ss')}`, // Show the current time with a clock emoji
                        inline: false, // Don't display timezone info inline
                    };
                })
        );

        // Create the buttons (previous and next page)
        const { createButtons } = require('../utils/loadUtils.js'); // Import the button creation utility
        await interaction.editReply({
            embeds: [embed], // Edit the reply with the new embed
            components: [createButtons(currentPage, totalPages)], // Generate the pagination buttons
        });
    },
};

/**
 * Returns the appropriate clock emoji based on the time.
 * @param {import('moment-timezone').Moment} time - The target time
 * @returns {string} The corresponding clock emoji
 */
function getClockEmoji(time) {
    const clockEmojis = [
        '🕛', '🕧', '🕐', '🕜', '🕑', '🕝', '🕒', '🕞', '🕓', '🕟', '🕔', '🕠',
        '🕕', '🕡', '🕖', '🕢', '🕗', '🕣', '🕘', '🕤', '🕙', '🕥', '🕚', '🕦'
    ];
    const emojiIndex = time.hours() % 12 * 2 + Math.floor(time.minutes() / 30);
    return clockEmojis[emojiIndex]; // Return the corresponding clock emoji based on the time
}