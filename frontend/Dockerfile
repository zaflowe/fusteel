FROM node:20-alpine

WORKDIR /app

# 使用阿里云 npm 镜像加速
RUN npm config set registry https://registry.npmmirror.com

# 安装依赖
COPY package*.json ./
RUN npm ci

# 复制应用代码
COPY . .

# 构建参数 - 支持构建时传入 API URL
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# 构建
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]