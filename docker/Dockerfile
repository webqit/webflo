# Base installations
FROM node:12-alpine
RUN apk add git

# We'll install npm packages at one-level higher than
# actuall app root, so that we can bind-mount host system's app root
# without overriding the container's node_modules directory
WORKDIR /home/www
RUN npm install
RUN npm install @webqit/webflo -g
RUN npm install @webqit/playui-cli -g

# Move one-level in, for the reasons above
WORKDIR /home/www/app
ENV NODE_OPTIONS=--openssl-legacy-provider

# To auto-start app (flags optional), we would add...
# CMD ["webflo", "start", "--env=dev", "--watch", "--http-only"]

# To build the image locally...
# docker build --no-cache -t webflo ./docker

# To publish to docker hub...
# docker login -u webqit
# docker tag webflo webqit/webflo
# docker push webqit/webflo
