"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const api_config_1 = require("./config/api.config");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix(api_config_1.API_CONFIG.PREFIX);
    app.enableVersioning({
        type: common_1.VersioningType.URI,
        defaultVersion: api_config_1.API_CONFIG.VERSION,
        prefix: api_config_1.API_CONFIG.VERSION_PREFIX,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    await app.listen(process.env.PORT ?? 3000);
    console.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
    console.log(`API Base URL: /${api_config_1.API_CONFIG.PREFIX}/v${api_config_1.API_CONFIG.VERSION}`);
}
bootstrap();
//# sourceMappingURL=main.js.map