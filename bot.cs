using Telegram.Bot;
using Telegram.Bot.Polling;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;

class Program
{
    static async Task Main()
    {
        var bot = new TelegramBotClient("8206787948:AAFdOkk9Shgc-WfL8Vv9SDu7MOr0gNB7zN0");

        using CancellationTokenSource cts = new();

        var receiverOptions = new ReceiverOptions
        {
            AllowedUpdates = Array.Empty<UpdateType>()
        };

        bot.StartReceiving(
            updateHandler: HandleUpdateAsync,
            pollingErrorHandler: HandleErrorAsync,
            receiverOptions: receiverOptions,
            cancellationToken: cts.Token
        );

        var me = await bot.GetMeAsync();
        Console.WriteLine($"Бот запущен: {me.Username}");
        Console.ReadLine();
        cts.Cancel();
    }

    // ---------------------------------
    // Основная логика обработки сообщений
    // ---------------------------------
    static async Task HandleUpdateAsync(ITelegramBotClient bot, Update update, CancellationToken token)
    {
        if (update.Type == UpdateType.Message && update.Message!.Text != null)
        {
            var msg = update.Message;

            if (msg.Text == "/start")
            {
                await SendStartMenu(bot, msg.Chat.Id);
                return;
            }

            // Реакция на кнопку "Открыть приложение"
            if (msg.Text == "Открыть приложение")
            {
                // Кнопка сама откроет WebApp, здесь можно ничего не делать
                return;
            }
        }

        // Обработка команд меню (support, channel, faq)
        if (update.Type == UpdateType.CallbackQuery)
        {
            var callback = update.CallbackQuery;
            var chatId = callback.Message.Chat.Id;

            switch (callback.Data)
            {
                case "support":
                    await bot.SendTextMessageAsync(
                        chatId,
                        "Открываю чат с поддержкой: https://t.me/YOUR_SUPPORT_PROFILE"
                    );
                    break;

                case "channel":
                    await bot.SendTextMessageAsync(
                        chatId,
                        "Канал разработчика: https://t.me/YOUR_CHANNEL"
                    );
                    break;

                case "faq":
                    await bot.SendTextMessageAsync(
                        chatId,
                        "Это приложение предназначено для создания и отслеживания ваших тренировок.\n\n" +
                        "Вы можете:\n" +
                        "- Создавать новые тренировки\n" +
                        "- Вести учет дней занятий\n" +
                        "- Просматривать свои тренировки\n" +
                        "- Использовать удобный WebApp прямо в Telegram\n\n" +
                        "Приложение полностью бесплатное и удобно для планирования ваших тренировок."
                    );
                    break;
            }

            await bot.AnswerCallbackQueryAsync(callback.Id);
        }
    }

    // --------------------------------------------
    // Главное меню: WebApp-кнопка + Telegram Menu
    // --------------------------------------------
    static async Task SendStartMenu(ITelegramBotClient bot, long chatId)
    {
        // Кнопка WebApp под полем ввода
        var keyboard = new ReplyKeyboardMarkup(new[]
        {
            new KeyboardButton[]
            {
                new KeyboardButton("Открыть приложение")
                {
                    WebApp = new WebAppInfo
                    {
                        Url = "https://your-webapp-url.com/"
                    }
                }
            }
        })
        {
            ResizeKeyboard = true,
            IsPersistent = true
        };

        // Меню Telegram (⋮) — команды бота
        await bot.SetMyCommandsAsync(new[]
        {
            new BotCommand { Command = "support", Description = "Поддержка" },
            new BotCommand { Command = "channel", Description = "Канал разработчика" },
            new BotCommand { Command = "faq", Description = "FAQ" }
        });

        await bot.SendTextMessageAsync(
            chatId,
            "Добро пожаловать! Открывай приложение кнопкой ниже.",
            replyMarkup: keyboard
        );
    }

    static Task HandleErrorAsync(ITelegramBotClient bot, Exception ex, CancellationToken token)
    {
        Console.WriteLine($"Ошибка: {ex.Message}");
        return Task.CompletedTask;
    }
}
