up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f backend

shell:
	docker compose exec backend /bin/bash

clean:
	docker compose down -v
	rm -f data/app.db
