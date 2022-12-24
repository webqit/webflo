# Base installations
# (Node 18 is the minimum required version: stable Fetch API, etc)
FROM node:18-alpine
RUN apk add git
RUN apk add certbot

# Refer to https://www.digitalocean.com/community/tutorials/how-to-build-a-node-js-application-with-docker
# By default, the Docker Node image includes a non-root node user that we can use to avoid running the application container as root.
USER node

# Create the working directory with node-user permissions
RUN mkdir -p /home/node/www/app && chown -R node:node /home/node/www
WORKDIR /home/node/www

# Adding this COPY instruction before running npm install or copying the application code allows you to take advantage of Docker’s caching mechanism.
COPY -chown=node:node package*.json ./

# Install
RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Copy application code with node-user permissions
COPY --chown=node:node . .

# Install Webflo and friends globally
RUN npm install @webqit/webflo -g
RUN npm install @webqit/oohtml-cli -g
RUN npm install pm2 -g

# The deployment directory
WORKDIR /home/node/www/app

# To auto-start app (flags optional), we would add...
# CMD ["webflo", "start"]

# To build the image locally...
# docker build --no-cache -t webflo ./docker

# To publish to docker hub...
# docker login -u webqit
# docker tag webflo webqit/webflo
# docker push webqit/webflo