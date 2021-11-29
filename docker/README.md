# Webflo Container
This is simply a node.js container with the `@webqit/webflo` framework installed. Once started, any webflo app can be deployed into the container from any git repository.

## Usage
This container image lives on Docker Hub and can be pulled to a local machine or a remote Virtual Machine (VM) on any cloud platform.

+ [To Use Locally](#to-use-locally)
+ [To Use In the Cloud](#to-use-in-the-cloud)
* [To Deploy An App From Any Repo](#to-deploy-an-app-from-any-repo)

### To Use Locally
Ensure you have docker installed on your computer and run the following command from any location on your terminal:

```shell
docker pull webqit/webflo:latest
```

The above command pulls the `webqit/webflo` image to your local machine. (But this can be automatically done by docker on running any docker commands that reference the `webqit/webflo` image.)

Next is to use the following commands to start the container and the Webflo runtime. In each case, the first part of the command starts the container, while the second part (from `webflo start`) starts the application.

#### To Start
Start the container using `docker run`; map a port (e.g `80`) of your host machine to `3000` of the container (unless changed webflo expects to run on port `3000`); optionally, give your container a name; reference `webqit/webflo` as the image to use; and lastly, start webflo using `webflo start`.

```shell
docker run -d -p 80:3000 --name my-app webqit/webflo webflo start
```

Visit [localhost](http://localhost) to view your app. 

#### To Start In Dev Mode
Webflo's *dev* mode is the perfect mode for developing locally. All you do is append the `--env=dev --watch` flags to your webflo commands. [(Learn more)](#)

```shell
docker run -d -p 80:3000 --name my-app webqit/webflo webflo start --env=dev --watch
```

In *dev* mode, webflo automatically restarts as you make changes to your codebase. Since webflo now lives inside a container, you'll need to *bind* the directory of your source code on your host machine to the `/home/www/app` directory of the container.

```shell
docker run -d -v /Users/me/my-app:/home/www/app -p 80:3000 --name my-app webqit/webflo webflo start --env=dev --watch
```

docker run -d -v /Users/ox-harris/Documents/CODE/webqit/webqit.io:/home/www/app -p 80:3000 --name my-app webqit/webflo webflo start --env=dev --watch

### To Use In the Cloud
TODO

### To Deploy An App From Any Repo
Whether running locally or in the cloud, webflo can easily take your application from any git repo. This follows webflo's normal `deploy` command.

Simply point docker at your container (using `docker exec [container-name]`) and execute the `webflo deploy` command.

```shell
docker exec my-app webflo deploy https://github.com/me/my-app
```

If you will need to install any npm dependencies, you would run `npm install` on the appropriate directory in your container.

```shell
docker exec my-app npm install
```

If you will need to run additional webflo commands (e.g `webflo restart` to restart the application), you would follow the same pattern above.

```shell
docker exec my-app webflo restart
```

## Extending this Build
TODO