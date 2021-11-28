# Base installations
FROM node:12-alpine
RUN apk --no-cache add git

# NODE_ENV for installation
ENV NODE_ENV development

# We'll install npm packages at one-level higher than
# actuall app root, so that we can bind-mount host system's app root
# without overriding the container's node_modules directory
WORKDIR /home/www
RUN npm install
RUN npm install @webqit/webflo -g 
RUN npm install @webqit/playui-cli -g

# Move one-level in, for the reasons above
WORKDIR /home/www/app

# To auto-start app (flags optional), we would add...
# CMD ["webflo", "start", "--dev", "--http-only"]

# To build the image locally...
# docker build --no-cache -t webflo .

# To publish to docker hub...
# docker login -u webqit
# docker tag webflo webqit/webflo
# docker push webqit/webflo