FROM nginx:1.27-alpine
COPY index.html styles.css app.js actors.js garden.js germination.js navigation.js ui.js /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
