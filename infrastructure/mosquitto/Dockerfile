FROM eclipse-mosquitto:2.0.22
USER root
RUN apk add --no-cache nodejs tini
COPY mosquitto.conf.template /mosquitto/config/mosquitto.conf.template
COPY entrypoint.sh /usr/local/bin/nexora-mosquitto-entrypoint
COPY tools /opt/nexora/tools
RUN chmod 0755 /usr/local/bin/nexora-mosquitto-entrypoint /opt/nexora/tools/*.sh && chown -R mosquitto:mosquitto /mosquitto
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/nexora-mosquitto-entrypoint"]
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["/opt/nexora/tools/healthcheck.sh"]
